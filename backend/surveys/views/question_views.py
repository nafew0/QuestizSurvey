from django.db.models import Max
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from surveys.models import Page, Question
from surveys.serializers import QuestionCreateSerializer, QuestionSerializer

from .common import get_owned_page, get_owned_survey


class QuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

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

    def perform_create(self, serializer):
        page = self.get_page()
        max_order = page.questions.aggregate(max_order=Max("order"))["max_order"] or 0
        order = serializer.validated_data.get("order", max_order + 1)
        serializer.save(page=page, order=order)

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
