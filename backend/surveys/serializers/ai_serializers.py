from rest_framework import serializers

from surveys.models import AIChatMessage, AIChatSession


class AISummaryRequestSerializer(serializers.Serializer):
    filters = serializers.JSONField(required=False)

    def validate_filters(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Filters must be an object.")
        return value


class AIChatSessionSerializer(serializers.ModelSerializer):
    last_message_preview = serializers.SerializerMethodField()

    class Meta:
        model = AIChatSession
        fields = [
            "id",
            "title",
            "created_at",
            "updated_at",
            "last_message_preview",
        ]

    def get_last_message_preview(self, obj):
        messages = getattr(obj, "_prefetched_objects_cache", {}).get("messages")
        if messages:
            latest = messages[0]
        else:
            latest = obj.messages.order_by("-created_at").first()

        if not latest:
            return ""

        return latest.content[:120]


class AIChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIChatMessage
        fields = [
            "id",
            "role",
            "content",
            "context_meta",
            "created_at",
        ]


class AIChatSessionDetailSerializer(AIChatSessionSerializer):
    messages = AIChatMessageSerializer(many=True, read_only=True)

    class Meta(AIChatSessionSerializer.Meta):
        fields = AIChatSessionSerializer.Meta.fields + ["messages"]


class AIChatMessageCreateSerializer(serializers.Serializer):
    message = serializers.CharField(
        allow_blank=False,
        trim_whitespace=True,
        max_length=4000,
    )
    filters = serializers.JSONField(required=False)

    def validate_filters(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Filters must be an object.")
        return value
