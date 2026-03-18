from django.db.models import Max
from django.db import transaction
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from subscriptions.services import LicenseService
from surveys.models import Page, Question
from surveys.services import (
    AIService,
    AIServiceConfigurationError,
    AIServiceRequestError,
)
from surveys.serializers import QuestionCreateSerializer, QuestionSerializer

from .common import get_owned_page, get_owned_survey


class QuestionImproveThrottle(SimpleRateThrottle):
    scope = "question_improve"
    rate = "10/min"

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }


class ImproveQuestionRequestSerializer(serializers.Serializer):
    draft_text = serializers.CharField(
        required=False,
        allow_blank=False,
        max_length=4000,
        trim_whitespace=True,
    )


class QuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def _build_plan_limit_response(self, message):
        return Response(
            {
                "detail": message,
                "code": "plan_limit",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    def get_page(self):
        _, page = get_owned_page(
            self.request.user,
            self.kwargs["survey_pk"],
            self.kwargs["page_pk"],
        )
        return page

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_queryset(self):
        return self.get_page().questions.prefetch_related("choices")

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return QuestionCreateSerializer
        return QuestionSerializer

    def get_throttles(self):
        if self.action == "improve":
            return [QuestionImproveThrottle()]
        return super().get_throttles()

    def perform_create(self, serializer):
        page = self.get_page()
        max_order = page.questions.aggregate(max_order=Max("order"))["max_order"] or 0
        order = serializer.validated_data.get("order", max_order + 1)
        serializer.save(page=page, order=order)

    def create(self, request, *args, **kwargs):
        survey = self.get_survey()
        with transaction.atomic():
            limit_check = LicenseService.check_can_add_question(
                survey,
                for_update=True,
            )
            if not limit_check.allowed:
                return self._build_plan_limit_response(limit_check.message)
            return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["patch"])
    def reorder(self, request, survey_pk=None, page_pk=None):
        survey = self.get_survey()
        payload = request.data.get("questions", [])

        if not isinstance(payload, list) or not payload:
            return Response(
                {"detail": "Provide a non-empty 'questions' list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        questions = {
            str(question.id): question
            for question in Question.objects.filter(
                page__survey=survey,
                id__in=[item.get("id") for item in payload],
            ).select_related("page")
        }

        if len(questions) != len(payload):
            return Response(
                {"detail": "One or more questions are invalid for this survey."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        page_ids = {str(item.get("page")) for item in payload if item.get("page")}
        valid_pages = {
            str(page.id): page
            for page in Page.objects.filter(survey=survey, id__in=page_ids)
        }

        if len(valid_pages) != len(page_ids):
            return Response(
                {"detail": "One or more target pages are invalid for this survey."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_questions = []
        for item in payload:
            question = questions[str(item["id"])]
            if item.get("page"):
                question.page = valid_pages[str(item["page"])]
            question.order = item["order"]
            updated_questions.append(question)

        Question.objects.bulk_update(updated_questions, ["page", "order"])

        serializer = self.get_serializer(self.get_page().questions.all(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def improve(self, request, survey_pk=None, page_pk=None, pk=None):
        serializer = ImproveQuestionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        survey = self.get_survey()
        question = self.get_object()
        draft_text = serializer.validated_data.get("draft_text")
        source_text = draft_text if draft_text is not None else question.text

        if not (source_text or "").strip():
            return Response(
                {"detail": "Add question text before using AI improve."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ai_service = AIService()
        try:
            improved_text = ai_service.improve_question(
                survey.title,
                question.get_question_type_display(),
                source_text,
            )
        except AIServiceConfigurationError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AIServiceRequestError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "improved_text": improved_text,
                "provider": ai_service.provider,
            },
            status=status.HTTP_200_OK,
        )
