from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from surveys.models import Collector, EmailInvitation, Survey, SurveyResponse
from surveys.serializers import (
    PublicSurveySerializer,
    SubmitAnswerSerializer,
    SurveyResponseDetailSerializer,
    SurveyResponseSerializer,
)

from .common import get_owned_survey


class SurveyResponseViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_queryset(self):
        queryset = (
            self.get_survey()
            .responses.select_related(
                "collector",
                "current_page",
            )
            .prefetch_related("answers")
        )

        status_filter = self.request.query_params.get("status")
        collector_filter = self.request.query_params.get("collector")
        completed_after = self.request.query_params.get("completed_after")
        completed_before = self.request.query_params.get("completed_before")

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if collector_filter:
            queryset = queryset.filter(collector_id=collector_filter)

        if completed_after:
            parsed_after = parse_datetime(completed_after)
            if parsed_after:
                queryset = queryset.filter(completed_at__gte=parsed_after)

        if completed_before:
            parsed_before = parse_datetime(completed_before)
            if parsed_before:
                queryset = queryset.filter(completed_at__lte=parsed_before)

        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SurveyResponseDetailSerializer
        return SurveyResponseSerializer


class PublicSurveyView(APIView):
    permission_classes = [AllowAny]
    completion_cookie_days = 30

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

    def build_block_response(self, message, error_status, code):
        return Response(
            {
                "detail": message,
                "code": code,
            },
            status=error_status,
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
        return (
            request.query_params.get("access_key")
            or request.data.get("access_key")
            or ""
        ).strip()

    def get_public_block(
        self,
        survey,
        collector,
        *,
        resume_token=None,
        request=None,
        access_key="",
    ):
        if survey.status != Survey.Status.ACTIVE:
            return self.build_block_response(
                "This survey is not accepting responses right now.",
                status.HTTP_410_GONE,
                "survey_inactive",
            )

        settings = self.get_public_settings(survey, collector)

        password = (settings.get("password") or "").strip()
        if settings.get("password_enabled") and password:
            if not access_key:
                return self.build_block_response(
                    "This survey link is password protected.",
                    status.HTTP_403_FORBIDDEN,
                    "password_required",
                )

            if access_key != password:
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

        allow_multiple = settings.get(
            "allow_multiple",
            settings.get("multi_response", True),
        )

        if request and not allow_multiple and not resume_token:
            client_ip = self._get_client_ip(request)
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

    def get(self, request, slug):
        survey = self.get_survey(slug)
        invite_token = request.query_params.get("invite")
        invitation = self.get_requested_invitation(survey, invite_token)
        if invite_token and not invitation:
            return self.build_block_response(
                "This invitation link is invalid.",
                status.HTTP_404_NOT_FOUND,
                "invalid_invitation",
            )
        resume_token = request.query_params.get("resume_token")
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
            request=request,
            access_key=self.get_access_key(request),
        )
        if block_response:
            return block_response

        serializer = PublicSurveySerializer(survey)
        response_data = serializer.data

        if survey_response:
            response_data["response"] = SurveyResponseDetailSerializer(
                survey_response
            ).data

        return Response(response_data, status=status.HTTP_200_OK)

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
        )
        if block_response:
            return block_response

        serializer = SubmitAnswerSerializer(
            data=request.data,
            context={
                "survey": survey,
                "default_collector": collector,
                "ip_address": self._get_client_ip(request),
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            },
        )
        serializer.is_valid(raise_exception=True)
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
            request=request,
            access_key=self.get_access_key(request),
        )
        if block_response:
            return block_response

        serializer = SubmitAnswerSerializer(
            data=request.data,
            context={
                "survey": survey,
                "default_collector": collector,
                "ip_address": self._get_client_ip(request),
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            },
        )
        serializer.is_valid(raise_exception=True)
        updated_response = serializer.update_response(survey_response)
        updated_response = self.get_response_queryset().get(id=updated_response.id)
        response_serializer = SurveyResponseDetailSerializer(updated_response)
        response = Response(response_serializer.data, status=status.HTTP_200_OK)
        if updated_response.status == SurveyResponse.Status.COMPLETED:
            self.apply_completion_cookie(response, survey.slug)
        return response

    def _get_client_ip(self, request):
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")
