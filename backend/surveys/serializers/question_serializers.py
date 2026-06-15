from django.db import transaction
from rest_framework import serializers

from surveys.input_validation import (
    normalize_question_input_validation_settings,
    validate_question_input_validation_settings,
)
from surveys.models import Choice, Question
from surveys.rich_text import rich_text_to_plain_text, sanitize_rich_text_html

from .choice_serializers import ChoiceSerializer


class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["settings"] = _normalize_question_settings_payload(data.get("settings"))
        return data

    class Meta:
        model = Question
        fields = [
            "id",
            "page",
            "question_type",
            "text",
            "description",
            "required",
            "order",
            "settings",
            "skip_logic",
            "choices",
        ]
        read_only_fields = ["page"]


class QuestionWithChoicesSerializer(QuestionSerializer):
    pass


class QuestionCreateSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, required=False)

    def validate_settings(self, value):
        normalized_settings = _normalize_question_settings_payload(value)
        validation_errors = validate_question_input_validation_settings(
            normalized_settings
        )
        if validation_errors:
            raise serializers.ValidationError(validation_errors)
        return normalized_settings

    def validate(self, attrs):
        settings = attrs.get("settings")
        rich_text_html = _get_question_text_html(settings)
        if rich_text_html is not None:
            attrs["text"] = rich_text_to_plain_text(rich_text_html)
        return attrs

    class Meta:
        model = Question
        fields = [
            "id",
            "page",
            "question_type",
            "text",
            "description",
            "required",
            "order",
            "settings",
            "skip_logic",
            "choices",
        ]
        read_only_fields = ["page"]

    def create(self, validated_data):
        with transaction.atomic():
            choices_data = validated_data.pop("choices", [])
            question = Question.objects.create(**validated_data)
            self._sync_choices(question, choices_data)
            return question

    def update(self, instance, validated_data):
        with transaction.atomic():
            choices_data = validated_data.pop("choices", None)

            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if choices_data is not None:
                self._sync_choices(instance, choices_data)

            return instance

    def _sync_choices(self, question, choices_data):
        existing_choices = {str(choice.id): choice for choice in question.choices.all()}
        retained_ids = []

        for index, choice_data in enumerate(choices_data, start=1):
            choice_id = choice_data.get("id")
            order = choice_data.get("order", index)
            defaults = {
                "text": choice_data["text"],
                "image_url": choice_data.get("image_url"),
                "is_other": choice_data.get("is_other", False),
                "order": order,
                "score": choice_data.get("score"),
            }

            if choice_id and str(choice_id) in existing_choices:
                choice = existing_choices[str(choice_id)]
                for attr, value in defaults.items():
                    setattr(choice, attr, value)
                choice.save()
            else:
                create_kwargs = {"question": question, **defaults}
                if choice_id:
                    create_kwargs["id"] = choice_id
                choice = Choice.objects.create(**create_kwargs)

            retained_ids.append(choice.id)

        question.choices.exclude(id__in=retained_ids).delete()


def _get_question_text_html(settings):
    if not isinstance(settings, dict):
        return None

    rich_text = settings.get("rich_text")
    if not isinstance(rich_text, dict):
        return None

    return rich_text.get("text_html")


def _normalize_question_settings_payload(settings):
    normalized = normalize_question_input_validation_settings(settings)
    rich_text = normalized.get("rich_text")

    if not isinstance(rich_text, dict):
        return normalized

    next_rich_text = dict(rich_text)
    if "text_html" in next_rich_text:
        next_rich_text["text_html"] = sanitize_rich_text_html(next_rich_text.get("text_html"))

    normalized["rich_text"] = next_rich_text
    return normalized
