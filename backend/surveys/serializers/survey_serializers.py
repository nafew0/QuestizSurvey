from rest_framework import serializers

from surveys.models import Survey

from .page_serializers import PageSerializer


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


class SurveyDetailSerializer(serializers.ModelSerializer):
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


class SurveyCreateUpdateSerializer(serializers.ModelSerializer):
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


class PublicSurveySerializer(serializers.ModelSerializer):
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
