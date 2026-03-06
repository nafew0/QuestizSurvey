from django.utils import timezone
from rest_framework import serializers

from surveys.models import Answer, Collector, Page, Question, SurveyResponse


class AnswerSerializer(serializers.ModelSerializer):
    question = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Answer
        fields = [
            "id",
            "question",
            "choice_ids",
            "text_value",
            "numeric_value",
            "date_value",
            "file_url",
            "matrix_data",
            "ranking_data",
            "constant_sum_data",
            "other_text",
            "comment_text",
            "answered_at",
        ]


class SurveyResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyResponse
        fields = [
            "id",
            "status",
            "started_at",
            "completed_at",
            "duration_seconds",
            "respondent_email",
        ]


class SurveyResponseDetailSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, read_only=True)

    class Meta:
        model = SurveyResponse
        fields = [
            "id",
            "survey",
            "collector",
            "respondent_email",
            "status",
            "ip_address",
            "user_agent",
            "started_at",
            "completed_at",
            "last_active_at",
            "duration_seconds",
            "current_page",
            "resume_token",
            "answers",
        ]


class SubmitAnswerItemSerializer(serializers.Serializer):
    question = serializers.PrimaryKeyRelatedField(
        queryset=Question.objects.select_related("page").all()
    )
    choice_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )
    text_value = serializers.CharField(required=False, allow_blank=True)
    numeric_value = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    date_value = serializers.DateTimeField(required=False, allow_null=True)
    file_url = serializers.URLField(required=False, allow_blank=True)
    matrix_data = serializers.JSONField(required=False, allow_null=True)
    ranking_data = serializers.JSONField(required=False, allow_null=True)
    constant_sum_data = serializers.JSONField(required=False, allow_null=True)
    other_text = serializers.CharField(required=False, allow_blank=True)
    comment_text = serializers.CharField(required=False, allow_blank=True)


class SubmitAnswerSerializer(serializers.Serializer):
    collector = serializers.PrimaryKeyRelatedField(
        queryset=Collector.objects.select_related("survey").all(),
        required=False,
        allow_null=True,
    )
    respondent_email = serializers.EmailField(
        required=False, allow_blank=True, allow_null=True
    )
    status = serializers.ChoiceField(
        choices=SurveyResponse.Status.choices,
        required=False,
        default=SurveyResponse.Status.IN_PROGRESS,
    )
    current_page = serializers.PrimaryKeyRelatedField(
        queryset=Page.objects.select_related("survey").all(),
        required=False,
        allow_null=True,
    )
    resume_token = serializers.CharField(required=False, allow_blank=True)
    answers = SubmitAnswerItemSerializer(many=True, required=False, default=list)

    def validate(self, attrs):
        survey = self.context["survey"]
        collector = attrs.get("collector")
        current_page = attrs.get("current_page")

        if collector and collector.survey_id != survey.id:
            raise serializers.ValidationError(
                {"collector": "Collector does not belong to this survey."}
            )

        if current_page and current_page.survey_id != survey.id:
            raise serializers.ValidationError(
                {"current_page": "Page does not belong to this survey."}
            )

        for answer_data in attrs.get("answers", []):
            question = answer_data["question"]
            if question.page.survey_id != survey.id:
                raise serializers.ValidationError(
                    {"answers": "Question does not belong to this survey."}
                )

            submitted_choice_ids = {
                str(choice_id) for choice_id in answer_data.get("choice_ids", [])
            }
            valid_choice_ids = {
                str(choice_id)
                for choice_id in question.choices.values_list("id", flat=True)
            }
            if not submitted_choice_ids.issubset(valid_choice_ids):
                raise serializers.ValidationError(
                    {"answers": "Choice does not belong to the supplied question."}
                )

        return attrs

    def create_response(self):
        survey = self.context["survey"]
        validated_data = dict(self.validated_data)
        response = SurveyResponse.objects.create(
            survey=survey,
            ip_address=self.context.get("ip_address"),
            user_agent=self.context.get("user_agent", ""),
        )
        return self._apply_submission(response, validated_data)

    def update_response(self, response):
        validated_data = dict(self.validated_data)
        return self._apply_submission(response, validated_data)

    def _apply_submission(self, response, validated_data):
        answers_data = validated_data.pop("answers", [])

        if "collector" in validated_data:
            response.collector = validated_data["collector"]

        if "respondent_email" in validated_data:
            response.respondent_email = validated_data["respondent_email"]

        if "status" in validated_data:
            response.status = validated_data["status"]

        if "current_page" in validated_data:
            response.current_page = validated_data["current_page"]

        if not response.ip_address:
            response.ip_address = self.context.get("ip_address")

        if not response.user_agent:
            response.user_agent = self.context.get("user_agent", "")

        if (
            response.status == SurveyResponse.Status.COMPLETED
            and response.completed_at is None
        ):
            response.completed_at = timezone.now()
            response.duration_seconds = int(
                (response.completed_at - response.started_at).total_seconds()
            )

        response.save()

        for answer_data in answers_data:
            question = answer_data.pop("question")
            defaults = {
                "choice_ids": [
                    str(choice_id) for choice_id in answer_data.get("choice_ids", [])
                ],
                "text_value": answer_data.get("text_value", ""),
                "numeric_value": answer_data.get("numeric_value"),
                "date_value": answer_data.get("date_value"),
                "file_url": answer_data.get("file_url", ""),
                "matrix_data": answer_data.get("matrix_data"),
                "ranking_data": answer_data.get("ranking_data"),
                "constant_sum_data": answer_data.get("constant_sum_data"),
                "other_text": answer_data.get("other_text", ""),
                "comment_text": answer_data.get("comment_text", ""),
            }
            Answer.objects.update_or_create(
                response=response,
                question=question,
                defaults=defaults,
            )

        return response
