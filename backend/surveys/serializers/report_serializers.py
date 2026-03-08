from django.conf import settings
from rest_framework import serializers

from surveys.models import SavedReport


class SavedReportSerializer(serializers.ModelSerializer):
    share_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    has_share_password = serializers.SerializerMethodField()
    public_url = serializers.SerializerMethodField()

    class Meta:
        model = SavedReport
        fields = [
            "id",
            "survey",
            "user",
            "name",
            "config",
            "is_shared",
            "share_password",
            "has_share_password",
            "public_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "survey",
            "user",
            "created_at",
            "updated_at",
        ]

    def get_has_share_password(self, obj):
        return obj.has_share_password()

    def get_public_url(self, obj):
        public_app_url = getattr(settings, "PUBLIC_APP_URL", "").rstrip("/")
        if not public_app_url or not obj.is_shared:
            return ""
        return f"{public_app_url}/reports/{obj.id}"

    def create(self, validated_data):
        share_password = validated_data.pop("share_password", None)
        instance = super().create(validated_data)
        if share_password not in (None,):
            instance.set_share_password(share_password or "")
            instance.save(update_fields=["share_password"])
        return instance

    def update(self, instance, validated_data):
        share_password = validated_data.pop("share_password", None)
        instance = super().update(instance, validated_data)
        if share_password is not None:
            instance.set_share_password(share_password or "")
            instance.save(update_fields=["share_password"])
        return instance
