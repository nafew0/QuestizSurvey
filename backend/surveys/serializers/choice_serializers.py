from rest_framework import serializers

from surveys.models import Choice


class ChoiceSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)

    class Meta:
        model = Choice
        fields = ["id", "question", "text", "image_url", "is_other", "order", "score"]
        read_only_fields = ["question"]
