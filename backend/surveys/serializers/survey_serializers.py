from django.db import models
from rest_framework import serializers

from subscriptions.services import LicenseService
from surveys.models import Survey
from surveys.rich_text import rich_text_to_plain_text, sanitize_rich_text_html
from surveys.security import normalize_access_settings, sanitize_access_settings
from surveys.theme import normalize_survey_theme

from .page_serializers import PageSerializer


class SurveyThemeSerializerMixin:
    def validate_theme(self, value):
        return normalize_survey_theme(value)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if "theme" in data:
            data["theme"] = normalize_survey_theme(getattr(instance, "theme", None))
        if "welcome_page" in data:
            data["welcome_page"] = _normalize_message_page_payload(data.get("welcome_page"))
        if "thank_you_page" in data:
            data["thank_you_page"] = _normalize_message_page_payload(data.get("thank_you_page"))
        return data


class SurveyListSerializer(serializers.ModelSerializer):
    response_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Survey
        fields = [
            "id",
            "title",
            "slug",
            "status",
            "response_count",
            "created_at",
            "updated_at",
        ]


class SurveyDetailSerializer(SurveyThemeSerializerMixin, serializers.ModelSerializer):
    pages = PageSerializer(many=True, read_only=True)

    class Meta:
        model = Survey
        fields = [
            "id",
            "user",
            "title",
            "description",
            "slug",
            "status",
            "theme",
            "settings",
            "welcome_page",
            "thank_you_page",
            "created_at",
            "updated_at",
            "pages",
        ]
        read_only_fields = ["id", "user", "slug", "created_at", "updated_at", "pages"]


class SurveyCreateUpdateSerializer(SurveyThemeSerializerMixin, serializers.ModelSerializer):
    def validate_settings(self, value):
        normalized = dict(value or {})
        if self.instance is None and "require_login" not in normalized:
            normalized["require_login"] = LicenseService.get_logged_in_users_only_default()
        try:
            return normalize_access_settings(
                normalized,
                existing_settings=self.instance.settings if self.instance is not None else None,
            )
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_welcome_page(self, value):
        return _normalize_message_page_payload(value)

    def validate_thank_you_page(self, value):
        return _normalize_message_page_payload(value)

    class Meta:
        model = Survey
        fields = [
            "id",
            "title",
            "description",
            "slug",
            "status",
            "theme",
            "settings",
            "welcome_page",
            "thank_you_page",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "status", "created_at", "updated_at"]


class PublicSurveySerializer(SurveyThemeSerializerMixin, serializers.ModelSerializer):
    pages = PageSerializer(many=True, read_only=True)

    class Meta:
        model = Survey
        fields = [
            "id",
            "title",
            "description",
            "slug",
            "status",
            "theme",
            "settings",
            "welcome_page",
            "thank_you_page",
            "pages",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["settings"] = sanitize_access_settings(data.get("settings"))
        return data


class SurveyThemeAssetUploadSerializer(serializers.Serializer):
    class AssetType(models.TextChoices):
        LOGO = "logo", "Logo"
        BACKGROUND = "background", "Background"

    asset_type = serializers.ChoiceField(choices=AssetType.choices)
    asset = serializers.FileField(required=False, allow_null=True)
    clear = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        clear = bool(attrs.get("clear"))
        asset = attrs.get("asset")

        if clear and asset is not None:
            raise serializers.ValidationError(
                "Clear requests should not include a file upload."
            )

        if not clear and asset is None:
            raise serializers.ValidationError(
                {"asset": "Upload an asset or set clear=true."}
            )

        if asset is not None:
            content_type = getattr(asset, "content_type", "") or ""
            if content_type and not content_type.startswith("image/"):
                raise serializers.ValidationError(
                    {"asset": "Only image uploads are supported for survey themes."}
                )

        return attrs


def _normalize_message_page_payload(value):
    normalized = dict(value or {})
    if "desc_html" not in normalized:
        return normalized

    normalized["desc_html"] = sanitize_rich_text_html(normalized.get("desc_html"))
    normalized["desc"] = rich_text_to_plain_text(normalized["desc_html"])
    return normalized
