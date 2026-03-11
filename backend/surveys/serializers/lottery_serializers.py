from rest_framework import serializers

from surveys.services.lottery import (
    DEFAULT_PRIZE_SLOTS,
    build_lottery_field_catalog,
)


class SurveyLotterySettingsSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False, default=True)
    selected_fields = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    prize_slots = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=DEFAULT_PRIZE_SLOTS[:],
    )
    exclude_previous_winners = serializers.BooleanField(
        required=False,
        default=True,
    )

    def validate_selected_fields(self, value):
        survey = self.context["survey"]
        valid_field_ids = {
            field["id"]
            for field in build_lottery_field_catalog(survey)
        }
        normalized = []

        for field_id in value:
            next_field_id = str(field_id or "").strip()
            if not next_field_id:
                continue
            if next_field_id not in valid_field_ids:
                raise serializers.ValidationError(
                    f"Unknown lottery field: {next_field_id}"
                )
            if next_field_id not in normalized:
                normalized.append(next_field_id)

        return normalized

    def validate_prize_slots(self, value):
        normalized = []

        for label in value:
            next_label = str(label or "").strip()
            if not next_label:
                continue
            if next_label not in normalized:
                normalized.append(next_label)

        if not normalized:
            raise serializers.ValidationError(
                "Add at least one prize slot before saving the lottery."
            )

        return normalized


class SurveyLotteryDrawSerializer(serializers.Serializer):
    prize_label = serializers.CharField(required=False, allow_blank=True)
