from rest_framework import serializers

from surveys.models import Page

from .question_serializers import QuestionWithChoicesSerializer


class PageSerializer(serializers.ModelSerializer):
    questions = QuestionWithChoicesSerializer(many=True, read_only=True)

    class Meta:
        model = Page
        fields = [
            "id",
            "survey",
            "title",
            "description",
            "order",
            "skip_logic",
            "questions",
        ]
        read_only_fields = ["survey"]
