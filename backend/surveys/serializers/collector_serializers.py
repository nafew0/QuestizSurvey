from rest_framework import serializers

from surveys.models import Collector, EmailInvitation
from surveys.security import normalize_access_settings, sanitize_access_settings


def parse_email_lines(values):
    emails = []
    seen = set()
    email_field = serializers.EmailField()

    for raw_value in values:
        for candidate in raw_value.replace(";", "\n").replace(",", "\n").splitlines():
            normalized = candidate.strip().lower()
            if not normalized or normalized in seen:
                continue
            normalized = email_field.run_validation(normalized)
            seen.add(normalized)
            emails.append(normalized)

    return emails


class CollectorSerializer(serializers.ModelSerializer):
    def validate_settings(self, value):
        collector_type = (
            self.instance.type
            if self.instance is not None
            else self.initial_data.get("type")
            or self.context.get("collector_type")
        )
        if collector_type != Collector.CollectorType.WEB_LINK:
            return value

        try:
            return normalize_access_settings(
                value,
                existing_settings=self.instance.settings if self.instance is not None else None,
            )
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.type == Collector.CollectorType.WEB_LINK:
            data["settings"] = sanitize_access_settings(instance.settings)
        return data

    class Meta:
        model = Collector
        fields = ["id", "survey", "type", "name", "status", "settings", "created_at"]
        read_only_fields = ["survey", "created_at"]


class EmailInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailInvitation
        fields = [
            "id",
            "email",
            "status",
            "sent_at",
            "opened_at",
            "completed_at",
        ]


class CollectorSendEmailsSerializer(serializers.Serializer):
    emails = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        allow_empty=False,
    )
    emails_text = serializers.CharField(required=False, allow_blank=True)
    subject = serializers.CharField(required=False, allow_blank=True, max_length=255)
    message = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        parsed_emails = parse_email_lines(attrs.get("emails", []))
        if attrs.get("emails_text"):
            parsed_emails.extend(parse_email_lines([attrs["emails_text"]]))

        unique_emails = []
        seen = set()
        for email in parsed_emails:
            if email in seen:
                continue
            seen.add(email)
            unique_emails.append(email)

        if not unique_emails:
            raise serializers.ValidationError(
                {"emails_text": "Add at least one valid email address."}
            )

        attrs["parsed_emails"] = unique_emails
        return attrs


class CollectorSendRemindersSerializer(serializers.Serializer):
    invitation_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=False,
    )
