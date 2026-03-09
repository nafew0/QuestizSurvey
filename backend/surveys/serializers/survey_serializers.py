from django.db import models
from rest_framework import serializers

from surveys.models import Survey
from surveys.theme import normalize_survey_theme

from .page_serializers import PageSerializer


class SurveyThemeSerializerMixin:
    def validate_theme(self, value):
        return normalize_survey_theme(value)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if "theme" in data:
            data["theme"] = normalize_survey_theme(getattr(instance, "theme", None))
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
