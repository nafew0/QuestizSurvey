from django.db import transaction
from django.db.models import Max
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from surveys.models import Page
from surveys.serializers import PageSerializer

from .common import get_owned_survey


class PageViewSet(viewsets.ModelViewSet):
    serializer_class = PageSerializer
    permission_classes = [IsAuthenticated]

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_queryset(self):
        return self.get_survey().pages.prefetch_related("questions__choices")

    def perform_create(self, serializer):
        survey = self.get_survey()
        max_order = survey.pages.aggregate(max_order=Max("order"))["max_order"] or 0
        order = serializer.validated_data.get("order", max_order + 1)
        serializer.save(survey=survey, order=order)

    @action(detail=False, methods=["patch"])
    def reorder(self, request, survey_pk=None):
        survey = self.get_survey()
        payload = request.data.get("pages", [])

        if not isinstance(payload, list) or not payload:
            return Response(
                {"detail": "Provide a non-empty 'pages' list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(payload) != survey.pages.count():
            return Response(
                {"detail": "Provide the full page order for the survey."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pages = {
            str(page.id): page
            for page in survey.pages.filter(id__in=[item.get("id") for item in payload])
        }

        if len(pages) != len(payload):
            return Response(
                {"detail": "One or more pages are invalid for this survey."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            temp_order = (
                survey.pages.aggregate(max_order=Max("order"))["max_order"] or 0
            ) + 1000
            staged_pages = []
            for page in pages.values():
                page.order = temp_order
                temp_order += 1
                staged_pages.append(page)
            Page.objects.bulk_update(staged_pages, ["order"])

            updated_pages = []
            for item in payload:
                page = pages[str(item["id"])]
                page.order = item["order"]
                updated_pages.append(page)
            Page.objects.bulk_update(updated_pages, ["order"])

        serializer = self.get_serializer(survey.pages.all(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
