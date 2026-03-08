from rest_framework import serializers

from surveys.models import SavedReport


class SavedReportSerializer(serializers.ModelSerializer):
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
