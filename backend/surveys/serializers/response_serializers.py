from django.utils import timezone
from rest_framework import serializers

from surveys.models import (
    Answer,
    Collector,
    EmailInvitation,
    Page,
    Question,
    SurveyResponse,
)


def _truncate_text(value, *, limit=48):
    if len(value) <= limit:
        return value
    return f"{value[: limit - 1].rstrip()}…"


def build_answer_summary(answer):
    question = getattr(answer, "question", None)
    question_type = getattr(question, "question_type", "")
    choice_map = {
        str(choice.id): choice.text for choice in getattr(question, "choices", []).all()
    } if question is not None else {}

    if answer.choice_ids:
        selected_labels = [
            choice_map.get(str(choice_id), str(choice_id))
            for choice_id in answer.choice_ids
        ]
        summary = ", ".join(selected_labels)
    elif answer.text_value:
        summary = answer.text_value
    elif answer.numeric_value is not None:
        summary = str(answer.numeric_value)
    elif answer.date_value:
        summary = answer.date_value.isoformat()
    elif answer.file_url:
        summary = answer.file_url
    elif answer.ranking_data:
        ranked_labels = [
            choice_map.get(str(choice_id), str(choice_id))
            for choice_id in answer.ranking_data
        ]
        summary = " > ".join(ranked_labels)
    elif answer.constant_sum_data:
        summary = f"{len(answer.constant_sum_data)} allocations"
    elif answer.matrix_data:
        if question_type == Question.QuestionType.DEMOGRAPHICS:
            summary = ", ".join(
                f"{field}: {value}" for field, value in answer.matrix_data.items() if value
            )
        else:
            summary = f"{len(answer.matrix_data)} rows answered"
    else:
        summary = ""

    return _truncate_text(summary)


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
    collector = serializers.PrimaryKeyRelatedField(read_only=True)
    answer_summaries = serializers.SerializerMethodField()

    class Meta:
        model = SurveyResponse
        fields = [
            "id",
            "collector",
            "status",
            "started_at",
            "completed_at",
            "duration_seconds",
            "respondent_email",
            "answer_summaries",
        ]

    def get_answer_summaries(self, obj):
        answers = list(getattr(obj, "answers", []).all())[:3]
        return [
            {
                "question_id": str(answer.question_id),
                "question_text": answer.question.text,
                "summary": build_answer_summary(answer),
            }
            for answer in answers
        ]


class AnswerDetailSerializer(serializers.ModelSerializer):
    question_id = serializers.UUIDField(source="question.id", read_only=True)
    question_text = serializers.CharField(source="question.text", read_only=True)
    question_type = serializers.CharField(source="question.question_type", read_only=True)
    choice_texts = serializers.SerializerMethodField()
    ranking_texts = serializers.SerializerMethodField()
    constant_sum_items = serializers.SerializerMethodField()
    question_choices = serializers.SerializerMethodField()

    class Meta:
        model = Answer
        fields = [
            "id",
            "question_id",
            "question_text",
            "question_type",
            "choice_ids",
            "choice_texts",
            "ranking_texts",
            "constant_sum_items",
            "question_choices",
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

    def get_choice_texts(self, obj):
        question = obj.question
        choice_map = {str(choice.id): choice.text for choice in question.choices.all()}
        return [
            choice_map.get(str(choice_id), str(choice_id))
            for choice_id in obj.choice_ids
        ]

    def get_ranking_texts(self, obj):
        question = obj.question
        choice_map = {str(choice.id): choice.text for choice in question.choices.all()}
        return [
            choice_map.get(str(choice_id), str(choice_id))
            for choice_id in (obj.ranking_data or [])
        ]

    def get_constant_sum_items(self, obj):
        question = obj.question
        choice_map = {str(choice.id): choice.text for choice in question.choices.all()}
        return [
            {
                "choice_id": choice_id,
                "text": choice_map.get(str(choice_id), str(choice_id)),
                "value": value,
            }
            for choice_id, value in (obj.constant_sum_data or {}).items()
        ]

    def get_question_choices(self, obj):
        return [
            {
                "id": str(choice.id),
                "text": choice.text,
            }
            for choice in obj.question.choices.all()
        ]


class SurveyResponseDetailSerializer(serializers.ModelSerializer):
    answers = AnswerDetailSerializer(many=True, read_only=True)
    email_invitation = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = SurveyResponse
        fields = [
            "id",
            "survey",
            "collector",
            "email_invitation",
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


class BulkDeleteResponsesSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )


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
    invitation_token = serializers.CharField(required=False, allow_blank=True)
    access_key = serializers.CharField(required=False, allow_blank=True)
    resume_token = serializers.CharField(required=False, allow_blank=True)
    answers = SubmitAnswerItemSerializer(many=True, required=False, default=list)

    def validate(self, attrs):
        survey = self.context["survey"]
        collector = attrs.get("collector")
        current_page = attrs.get("current_page")
        invitation_token = attrs.get("invitation_token", "").strip()

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

        if invitation_token:
            invitation = EmailInvitation.objects.select_related(
                "collector__survey"
            ).filter(token=invitation_token).first()
            if not invitation or invitation.collector.survey_id != survey.id:
                raise serializers.ValidationError(
                    {"invitation_token": "Invitation token is invalid for this survey."}
                )

            attrs["email_invitation"] = invitation
            attrs["collector"] = invitation.collector

        return attrs

    def create_response(self):
        survey = self.context["survey"]
        validated_data = dict(self.validated_data)
        response = SurveyResponse.objects.create(
            survey=survey,
            collector=self.context.get("default_collector"),
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
        elif not response.collector and self.context.get("default_collector"):
            response.collector = self.context["default_collector"]

        if "email_invitation" in validated_data:
            response.email_invitation = validated_data["email_invitation"]
            response.collector = validated_data["email_invitation"].collector

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

        if response.status == SurveyResponse.Status.COMPLETED and response.email_invitation:
            invitation = response.email_invitation
            invitation.status = EmailInvitation.Status.COMPLETED
            if invitation.opened_at is None:
                invitation.opened_at = timezone.now()
            if invitation.sent_at is None:
                invitation.sent_at = timezone.now()
            invitation.completed_at = response.completed_at or timezone.now()
            invitation.save(
                update_fields=["status", "sent_at", "opened_at", "completed_at"]
            )

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
