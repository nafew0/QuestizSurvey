from rest_framework import serializers

from surveys.models import Choice, Question

from .choice_serializers import ChoiceSerializer


class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)

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
        choices_data = validated_data.pop("choices", [])
        question = Question.objects.create(**validated_data)
        self._sync_choices(question, choices_data)
        return question

    def update(self, instance, validated_data):
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
                choice = Choice.objects.create(question=question, **defaults)

            retained_ids.append(choice.id)

        question.choices.exclude(id__in=retained_ids).delete()
