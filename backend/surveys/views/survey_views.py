from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from surveys.models import Survey
from surveys.serializers import (
    SurveyCreateUpdateSerializer,
    SurveyDetailSerializer,
    SurveyListSerializer,
)
from surveys.utils import duplicate_survey_structure


class SurveyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = (
            Survey.objects.filter(user=self.request.user)
            .annotate(response_count=Count("responses", distinct=True))
            .order_by("-created_at")
        )

        if self.action in {"retrieve", "duplicate"}:
            queryset = queryset.prefetch_related("pages__questions__choices")

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return SurveyListSerializer

        if self.action in {"create", "update", "partial_update"}:
            return SurveyCreateUpdateSerializer

        return SurveyDetailSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        duplicated_survey = duplicate_survey_structure(self.get_object(), request.user)
        serializer = SurveyDetailSerializer(
            duplicated_survey,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        survey = self.get_object()
        survey.status = Survey.Status.ACTIVE
        survey.save(update_fields=["status", "updated_at"])
        serializer = SurveyDetailSerializer(
            survey, context=self.get_serializer_context()
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        survey = self.get_object()
        survey.status = Survey.Status.CLOSED
        survey.save(update_fields=["status", "updated_at"])
        serializer = SurveyDetailSerializer(
            survey, context=self.get_serializer_context()
        )
        return Response(serializer.data, status=status.HTTP_200_OK)
