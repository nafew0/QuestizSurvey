from rest_framework import serializers

from surveys.models import ExportJob, Question, SavedReport


class ExportJobCreateSerializer(serializers.Serializer):
    format = serializers.ChoiceField(choices=ExportJob.ExportFormat.choices)
    config = serializers.JSONField(required=False, default=dict)

    def validate(self, attrs):
        survey = self.context["survey"]
        user = self.context["request"].user
        config = attrs.get("config") or {}

        report_id = config.get("report_id")
        if report_id and not SavedReport.objects.filter(
            id=report_id,
            survey=survey,
            user=user,
        ).exists():
            raise serializers.ValidationError(
                {"config": "The selected saved report does not belong to this survey."}
            )

        question_ids = config.get("question_ids")
        if question_ids:
            valid_ids = set(
                Question.objects.filter(page__survey=survey).values_list("id", flat=True)
            )
            invalid_ids = [
                str(question_id)
                for question_id in question_ids
                if str(question_id) not in {str(valid_id) for valid_id in valid_ids}
            ]
            if invalid_ids:
                raise serializers.ValidationError(
                    {"config": f"Unknown question ids: {', '.join(invalid_ids)}"}
                )

        cross_tabs = config.get("include_cross_tabs") or []
        if not isinstance(cross_tabs, list):
            raise serializers.ValidationError(
                {"config": "include_cross_tabs must be a list."}
            )

        valid_question_ids = {
            str(question_id)
            for question_id in Question.objects.filter(page__survey=survey).values_list(
                "id", flat=True
            )
        }
        for cross_tab in cross_tabs:
            if not isinstance(cross_tab, dict):
                raise serializers.ValidationError(
                    {"config": "Each cross-tab entry must be an object."}
                )
            row_question_id = (
                cross_tab.get("row_question_id")
                or cross_tab.get("row_q_id")
                or cross_tab.get("row")
            )
            col_question_id = (
                cross_tab.get("col_question_id")
                or cross_tab.get("col_q_id")
                or cross_tab.get("col")
            )
            if row_question_id and str(row_question_id) not in valid_question_ids:
                raise serializers.ValidationError(
                    {"config": f"Unknown cross-tab row question id: {row_question_id}"}
                )
            if col_question_id and str(col_question_id) not in valid_question_ids:
                raise serializers.ValidationError(
                    {"config": f"Unknown cross-tab column question id: {col_question_id}"}
                )

        attrs["config"] = config
        return attrs


class ExportJobSerializer(serializers.ModelSerializer):
    is_ready = serializers.SerializerMethodField()

    class Meta:
        model = ExportJob
        fields = [
            "id",
            "survey",
            "user",
            "format",
            "config",
            "status",
            "file_url",
            "error_message",
            "created_at",
            "completed_at",
            "is_ready",
        ]
        read_only_fields = fields

    def get_is_ready(self, obj):
        return obj.status == ExportJob.Status.COMPLETED and bool(obj.file_url)
