from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Prefetch

from questizsurvey.client_ip import get_client_ip
from subscriptions.services import LicenseService
from surveys.models import Answer, Collector, EmailInvitation, Survey, SurveyResponse
from surveys.security import check_public_link_password, has_public_link_password
from surveys.services import ResponseFilterService
from surveys.serializers import (
    BulkDeleteResponsesSerializer,
    PublicSurveyLoadSerializer,
    PublicSurveySerializer,
    SubmitAnswerSerializer,
    SurveyResponseDetailSerializer,
    SurveyResponseSerializer,
)
from surveys.throttles import PublicSurveyWriteThrottle

from .common import get_owned_survey

class SurveyResponseViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    ordering_fields = {"started_at", "completed_at", "duration_seconds"}

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_queryset(self):
        queryset = (
            self.get_survey()
            .responses.select_related(
                "collector",
                "current_page",
                "email_invitation",
            )
            .prefetch_related(
                Prefetch(
                    "answers",
                    queryset=Answer.objects.select_related("question", "question__page")
                    .prefetch_related("question__choices")
                    .order_by("question__page__order", "question__order"),
                )
            )
        )
        filtered = ResponseFilterService.from_query_params(
            queryset,
            self.request.query_params,
        ).apply()
        return filtered.order_by(self.get_ordering())

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SurveyResponseDetailSerializer
        return SurveyResponseSerializer

    def get_ordering(self):
        ordering = self.request.query_params.get("ordering", "-started_at")
        normalized = ordering.lstrip("-")
        if normalized not in self.ordering_fields:
            return "-started_at"
        return ordering

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request, survey_pk=None):
        serializer = BulkDeleteResponsesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        queryset = self.get_survey().responses.filter(id__in=serializer.validated_data["ids"])
        deleted_count = queryset.count()
        queryset.delete()

        return Response({"deleted_count": deleted_count}, status=status.HTTP_200_OK)


class PublicSurveyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PublicSurveyWriteThrottle]
    completion_cookie_days = 30
    write_throttle_methods = {"POST", "PUT"}

    def get_throttles(self):
        if self.request.method not in self.write_throttle_methods:
            return []
        return super().get_throttles()

    def get_response_queryset(self):
        return SurveyResponse.objects.select_related(
            "survey", "collector", "current_page"
        ).prefetch_related("answers")

    def get_survey(self, slug):
        return get_object_or_404(
            Survey.objects.prefetch_related(
                "pages__questions__choices",
                "collectors",
            ),
            slug=slug,
        )

    def get_public_collector(self, survey):
        collectors = [
            collector
            for collector in survey.collectors.all()
            if collector.status == Collector.Status.OPEN
        ]
        if not collectors:
            return None

        preferred_collector = next(
            (
                collector
                for collector in collectors
                if collector.type == Collector.CollectorType.WEB_LINK
            ),
            None,
        )
        return preferred_collector or collectors[0]

    def get_public_settings(self, survey, collector):
        settings = dict(survey.settings or {})
        if collector:
            settings.update(collector.settings or {})
        return settings

    def build_login_required_response(self, survey):
        return Response(
            {
                "detail": "This survey requires you to log in.",
                "message": "This survey requires you to log in.",
                "code": "login_required",
                "require_login": True,
                "survey_title": survey.title,
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    def build_block_response(self, message, error_status, code):
        return Response(
            {
                "detail": message,
                "code": code,
            },
            status=error_status,
        )

    def build_plan_limit_response(self, message):
        return self.build_block_response(
            message,
            status.HTTP_403_FORBIDDEN,
            "plan_limit",
        )

    def get_requested_invitation(self, survey, invitation_token):
        if not invitation_token:
            return None

        invitation = EmailInvitation.objects.select_related(
            "collector__survey"
        ).filter(token=invitation_token).first()
        if not invitation or invitation.collector.survey_id != survey.id:
            return None

        return invitation

    def get_access_key(self, request):
        return (request.data.get("access_key") or "").strip()

    def get_password_session_key(self, survey, collector):
        collector_key = str(collector.id) if collector else "survey"
        return f"public_survey_access:{survey.id}:{collector_key}"

    def is_password_session_authorized(self, request, survey, collector):
        if not request:
            return False
        return bool(request.session.get(self.get_password_session_key(survey, collector)))

    def authorize_password_session(self, request, survey, collector):
        if not request or not collector:
            return
        request.session[self.get_password_session_key(survey, collector)] = True

    def get_public_block(
        self,
        survey,
        collector,
        *,
        resume_token=None,
        survey_response=None,
        request=None,
        access_key="",
        session_authorized=False,
    ):
        if survey.status != Survey.Status.ACTIVE:
            return self.build_block_response(
                "This survey is not accepting responses right now.",
                status.HTTP_410_GONE,
                "survey_inactive",
            )

        settings = self.get_public_settings(survey, collector)

        require_login = bool(settings.get("require_login"))
        if require_login:
            if not request or not request.user or not request.user.is_authenticated:
                return self.build_login_required_response(survey)

            if (
                survey_response
                and survey_response.user_id
                and str(survey_response.user_id) != str(request.user.id)
            ):
                return self.build_block_response(
                    "This resume link is invalid.",
                    status.HTTP_404_NOT_FOUND,
                    "invalid_resume",
                )

        if settings.get("password_enabled") and has_public_link_password(settings):
            if not access_key and not session_authorized:
                return self.build_block_response(
                    "This survey link is password protected.",
                    status.HTTP_403_FORBIDDEN,
                    "password_required",
                )

            if access_key and not check_public_link_password(settings, access_key):
                return self.build_block_response(
                    "The password for this survey link is incorrect.",
                    status.HTTP_403_FORBIDDEN,
                    "password_invalid",
                )

        close_date = settings.get("close_date")
        parsed_close_date = parse_datetime(close_date) if close_date else None
        if parsed_close_date and timezone.is_naive(parsed_close_date):
            parsed_close_date = timezone.make_aware(
                parsed_close_date,
                timezone.get_current_timezone(),
            )
        if parsed_close_date and parsed_close_date <= timezone.now():
            return self.build_block_response(
                "This survey is no longer accepting responses.",
                status.HTTP_410_GONE,
                "survey_closed",
            )

        response_limit = settings.get("response_limit")
        if response_limit not in (None, "", 0, "0") and not resume_token:
            if (
                survey.responses.filter(status=SurveyResponse.Status.COMPLETED).count()
                >= int(response_limit)
            ):
                return self.build_block_response(
                    "This survey is no longer accepting responses.",
                    status.HTTP_410_GONE,
                    "response_limit_reached",
                )

        if not resume_token:
            license_check = LicenseService.check_can_accept_response(survey)
            if not license_check.allowed:
                return self.build_plan_limit_response(license_check.message)

        allow_multiple = settings.get(
            "allow_multiple",
            settings.get("multi_response", True),
        )

        if request and not allow_multiple and not resume_token:
            if require_login and request.user.is_authenticated:
                if survey.responses.filter(
                    user=request.user,
                    status=SurveyResponse.Status.COMPLETED,
                ).exists():
                    return self.build_block_response(
                        "You have already completed this survey.",
                        status.HTTP_403_FORBIDDEN,
                        "already_completed",
                    )
            else:
                client_ip = get_client_ip(request)
                if client_ip and survey.responses.filter(
                    ip_address=client_ip,
                    status=SurveyResponse.Status.COMPLETED,
                ).exists():
                    return self.build_block_response(
                        "You have already completed this survey.",
                        status.HTTP_403_FORBIDDEN,
                        "already_completed",
                    )

        return None

    def apply_completion_cookie(self, response, survey_slug):
        response.set_cookie(
            key=f"questiz_responded_{survey_slug}",
            value="true",
            max_age=self.completion_cookie_days * 24 * 60 * 60,
            samesite="Lax",
        )
        return response

    def load_public_survey(
        self,
        request,
        slug,
        *,
        invitation_token="",
        resume_token="",
        access_key="",
    ):
        survey = self.get_survey(slug)
        invitation = self.get_requested_invitation(survey, invitation_token)
        if invitation_token and not invitation:
            return self.build_block_response(
                "This invitation link is invalid.",
                status.HTTP_404_NOT_FOUND,
                "invalid_invitation",
            )
        survey_response = None

        if resume_token:
            survey_response = get_object_or_404(
                SurveyResponse.objects.select_related(
                    "collector",
                    "email_invitation",
                ).prefetch_related("answers"),
                survey=survey,
                resume_token=resume_token,
            )

        collector = (
            survey_response.collector
            if survey_response and survey_response.collector_id
            else invitation.collector
            if invitation
            else self.get_public_collector(survey)
        )
        block_response = self.get_public_block(
            survey,
            collector,
            resume_token=resume_token,
            survey_response=survey_response,
            request=request,
            access_key=access_key,
            session_authorized=self.is_password_session_authorized(
                request,
                survey,
                collector,
            ),
        )
        if block_response:
            return block_response

        if access_key and collector:
            self.authorize_password_session(request, survey, collector)

        serializer = PublicSurveySerializer(survey)
        response_data = serializer.data

        if survey_response:
            response_data["response"] = SurveyResponseDetailSerializer(
                survey_response
            ).data

        return Response(response_data, status=status.HTTP_200_OK)

    def get(self, request, slug):
        return self.load_public_survey(request, slug)

    def post(self, request, slug):
        survey = self.get_survey(slug)
        invitation = self.get_requested_invitation(
            survey, request.data.get("invitation_token")
        )
        collector = invitation.collector if invitation else self.get_public_collector(survey)
        block_response = self.get_public_block(
            survey,
            collector,
            request=request,
            access_key=self.get_access_key(request),
            session_authorized=self.is_password_session_authorized(
                request,
                survey,
                collector,
            ),
        )
        if block_response:
            return block_response

        if self.get_access_key(request) and collector:
            self.authorize_password_session(request, survey, collector)

        serializer = SubmitAnswerSerializer(
            data=request.data,
            context={
                "survey": survey,
                "default_collector": collector,
                "authenticated_user": (
                    request.user
                    if bool((survey.settings or {}).get("require_login"))
                    and request.user.is_authenticated
                    else None
                ),
                "ip_address": get_client_ip(request),
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            },
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            status_value = serializer.validated_data.get("status", SurveyResponse.Status.IN_PROGRESS)
            if status_value == SurveyResponse.Status.COMPLETED:
                license_check = LicenseService.check_can_accept_response(
                    survey,
                    for_update=True,
                )
                if not license_check.allowed:
                    return self.build_plan_limit_response(license_check.message)
            survey_response = serializer.create_response()
        survey_response = self.get_response_queryset().get(id=survey_response.id)
        response_serializer = SurveyResponseDetailSerializer(survey_response)
        response = Response(response_serializer.data, status=status.HTTP_201_CREATED)
        if survey_response.status == SurveyResponse.Status.COMPLETED:
            self.apply_completion_cookie(response, survey.slug)
        return response

    def put(self, request, slug):
        survey = self.get_survey(slug)
        resume_token = request.data.get("resume_token")

        if not resume_token:
            return Response(
                {"resume_token": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        survey_response = get_object_or_404(
            SurveyResponse.objects.select_related(
                "collector",
                "email_invitation",
            ).prefetch_related("answers"),
            survey=survey,
            resume_token=resume_token,
        )
        invitation = self.get_requested_invitation(
            survey, request.data.get("invitation_token")
        )
        collector = (
            survey_response.collector
            or (invitation.collector if invitation else None)
            or self.get_public_collector(survey)
        )
        block_response = self.get_public_block(
            survey,
            collector,
            resume_token=resume_token,
            survey_response=survey_response,
            request=request,
            access_key=self.get_access_key(request),
            session_authorized=self.is_password_session_authorized(
                request,
                survey,
                collector,
            ),
        )
        if block_response:
            return block_response

        if self.get_access_key(request) and collector:
            self.authorize_password_session(request, survey, collector)

        serializer = SubmitAnswerSerializer(
            data=request.data,
            context={
                "survey": survey,
                "default_collector": collector,
                "authenticated_user": (
                    request.user
                    if bool((survey.settings or {}).get("require_login"))
                    and request.user.is_authenticated
                    else None
                ),
                "ip_address": get_client_ip(request),
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            },
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            next_status = serializer.validated_data.get("status", survey_response.status)
            if (
                next_status == SurveyResponse.Status.COMPLETED
                and survey_response.status != SurveyResponse.Status.COMPLETED
            ):
                license_check = LicenseService.check_can_accept_response(
                    survey,
                    for_update=True,
                )
                if not license_check.allowed:
                    return self.build_plan_limit_response(license_check.message)
            updated_response = serializer.update_response(survey_response)
        updated_response = self.get_response_queryset().get(id=updated_response.id)
        response_serializer = SurveyResponseDetailSerializer(updated_response)
        response = Response(response_serializer.data, status=status.HTTP_200_OK)
        if updated_response.status == SurveyResponse.Status.COMPLETED:
            self.apply_completion_cookie(response, survey.slug)
        return response

class PublicSurveyLoadView(PublicSurveyView):
    permission_classes = [AllowAny]
    write_throttle_methods = set()

    def post(self, request, slug):
        serializer = PublicSurveyLoadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.load_public_survey(
            request,
            slug,
            invitation_token=serializer.validated_data.get("invitation_token", ""),
            resume_token=serializer.validated_data.get("resume_token", ""),
            access_key=serializer.validated_data.get("access_key", ""),
        )
