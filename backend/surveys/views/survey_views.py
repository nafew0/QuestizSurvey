from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from surveys.models import Survey
from surveys.serializers import (
    SurveyCreateUpdateSerializer,
    SurveyDetailSerializer,
    SurveyListSerializer,
    SurveyLotteryDrawSerializer,
    SurveyLotterySettingsSerializer,
    SurveyThemeAssetUploadSerializer,
)
from surveys.services.lottery import (
    build_lottery_payload,
    draw_lottery_winner,
    normalize_lottery_settings,
    reset_lottery_history,
    set_lottery_settings,
)
from surveys.theme import (
    build_uploaded_asset_name,
    get_theme_asset_field,
    get_theme_asset_relative_path,
    normalize_survey_theme,
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

        if self.action in {"retrieve", "duplicate", "lottery", "lottery_draw", "lottery_reset"}:
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

    @action(detail=True, methods=["get", "patch"])
    def lottery(self, request, pk=None):
        survey = self.get_object()

        if request.method.lower() == "get":
            return Response(build_lottery_payload(survey), status=status.HTTP_200_OK)

        serializer = SurveyLotterySettingsSerializer(
            data=request.data,
            context={"survey": survey},
        )
        serializer.is_valid(raise_exception=True)

        current_lottery = normalize_lottery_settings(survey.settings)
        next_lottery = {
            **current_lottery,
            **serializer.validated_data,
        }
        set_lottery_settings(survey, next_lottery)

        return Response(build_lottery_payload(survey), status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="lottery/draw")
    def lottery_draw(self, request, pk=None):
        survey = self.get_object()
        serializer = SurveyLotteryDrawSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            payload = draw_lottery_winner(
                survey,
                serializer.validated_data.get("prize_label", ""),
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="lottery/reset")
    def lottery_reset(self, request, pk=None):
        survey = self.get_object()
        return Response(reset_lottery_history(survey), status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["post"],
        url_path="theme-assets",
        parser_classes=[MultiPartParser, FormParser],
    )
    def theme_assets(self, request, pk=None):
        survey = self.get_object()
        serializer = SurveyThemeAssetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        asset_type = serializer.validated_data["asset_type"]
        field_name = get_theme_asset_field(asset_type)
        next_theme = normalize_survey_theme(survey.theme)

        current_relative_path = get_theme_asset_relative_path(
            next_theme.get(field_name, ""),
            settings.MEDIA_URL,
        )

        if serializer.validated_data.get("clear"):
            if current_relative_path and default_storage.exists(current_relative_path):
                default_storage.delete(current_relative_path)

            next_theme[field_name] = ""
            survey.theme = next_theme
            survey.save(update_fields=["theme", "updated_at"])

            return Response(
                {
                    "asset_type": asset_type,
                    "field": field_name,
                    "url": "",
                    "theme": next_theme,
                },
                status=status.HTTP_200_OK,
            )

        upload = serializer.validated_data["asset"]
        upload_directory = Path("survey-theme-assets") / str(survey.id) / asset_type
        upload_basename = build_uploaded_asset_name(asset_type, upload.name)
        upload_path = default_storage.save(
            str(upload_directory / upload_basename),
            upload,
        )

        if current_relative_path and current_relative_path != upload_path and default_storage.exists(
            current_relative_path
        ):
            default_storage.delete(current_relative_path)

        media_prefix = f"/{str(settings.MEDIA_URL).strip('/')}/"
        uploaded_url = request.build_absolute_uri(f"{media_prefix}{upload_path}")

        next_theme[field_name] = uploaded_url
        survey.theme = next_theme
        survey.save(update_fields=["theme", "updated_at"])

        return Response(
            {
                "asset_type": asset_type,
                "field": field_name,
                "url": uploaded_url,
                "theme": next_theme,
            },
            status=status.HTTP_200_OK,
        )
