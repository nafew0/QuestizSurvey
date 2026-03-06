from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from surveys.models import Survey, SurveyResponse
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

    def get_response_queryset(self):
        return SurveyResponse.objects.select_related(
            "survey", "collector", "current_page"
        ).prefetch_related("answers")

    def get_survey(self, slug):
        return get_object_or_404(
            Survey.objects.prefetch_related("pages__questions__choices"),
            slug=slug,
            status=Survey.Status.ACTIVE,
        )

    def get(self, request, slug):
        survey = self.get_survey(slug)
        serializer = PublicSurveySerializer(survey)
        response_data = serializer.data

        resume_token = request.query_params.get("resume_token")
        if resume_token:
            survey_response = get_object_or_404(
                SurveyResponse.objects.prefetch_related("answers"),
                survey=survey,
                resume_token=resume_token,
            )
            response_data["response"] = SurveyResponseDetailSerializer(
                survey_response
            ).data

        return Response(response_data, status=status.HTTP_200_OK)

    def post(self, request, slug):
        survey = self.get_survey(slug)
        serializer = SubmitAnswerSerializer(
            data=request.data,
            context={
                "survey": survey,
                "ip_address": self._get_client_ip(request),
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            },
        )
        serializer.is_valid(raise_exception=True)
        survey_response = serializer.create_response()
        survey_response = self.get_response_queryset().get(id=survey_response.id)
        response_serializer = SurveyResponseDetailSerializer(survey_response)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def put(self, request, slug):
        survey = self.get_survey(slug)
        resume_token = request.data.get("resume_token")

        if not resume_token:
            return Response(
                {"resume_token": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        survey_response = get_object_or_404(
            SurveyResponse.objects.prefetch_related("answers"),
            survey=survey,
            resume_token=resume_token,
        )
        serializer = SubmitAnswerSerializer(
            data=request.data,
            context={
                "survey": survey,
                "ip_address": self._get_client_ip(request),
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            },
        )
        serializer.is_valid(raise_exception=True)
        updated_response = serializer.update_response(survey_response)
        updated_response = self.get_response_queryset().get(id=updated_response.id)
        response_serializer = SurveyResponseDetailSerializer(updated_response)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def _get_client_ip(self, request):
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")
