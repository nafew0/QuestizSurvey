from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from subscriptions.models import SubscriptionEvent, UserSubscription
from subscriptions.serializers import PlanSummarySerializer
from subscriptions.services import LicenseService

from .models import SiteSettings

User = get_user_model()


def mask_secret(value):
    normalized = (value or "").strip()
    if not normalized:
        return ""
    if len(normalized) <= 8:
        return "*" * len(normalized)
    return f"{normalized[:4]}{'*' * (len(normalized) - 8)}{normalized[-4:]}"


class AdminSubscriptionSummarySerializer(serializers.ModelSerializer):
    plan = PlanSummarySerializer(read_only=True)

    class Meta:
        model = UserSubscription
        fields = [
            "id",
            "plan",
            "status",
            "billing_cycle",
            "payment_provider",
            "cancel_at_period_end",
            "cancel_requested_at",
            "current_period_start",
            "current_period_end",
        ]


class AdminUserListSerializer(serializers.ModelSerializer):
    current_plan = serializers.SerializerMethodField()
    survey_count = serializers.IntegerField(read_only=True)
    response_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_superuser",
            "email_verified",
            "current_plan",
            "survey_count",
            "response_count",
            "created_at",
            "last_login",
        ]

    def get_current_plan(self, obj):
        subscription = getattr(obj, "subscription", None)
        plan = subscription.plan if subscription else LicenseService.get_free_plan()
        return PlanSummarySerializer(plan).data


class AdminUserDetailSerializer(serializers.ModelSerializer):
    subscription = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "bio",
            "organization",
            "designation",
            "phone",
            "is_active",
            "is_staff",
            "is_superuser",
            "email_verified",
            "created_at",
            "last_login",
            "subscription",
        ]

    def get_subscription(self, obj):
        subscription = getattr(obj, "subscription", None) or LicenseService.get_user_subscription(
            obj
        )
        return AdminSubscriptionSummarySerializer(subscription).data


class AdminUserUpdateSerializer(serializers.Serializer):
    is_active = serializers.BooleanField(required=False)
    plan_id = serializers.UUIDField(required=False)


class SubscriptionEventSerializer(serializers.ModelSerializer):
    plan = PlanSummarySerializer(read_only=True)

    class Meta:
        model = SubscriptionEvent
        fields = [
            "id",
            "event_type",
            "plan",
            "status",
            "payment_provider",
            "billing_cycle",
            "metadata",
            "created_at",
        ]


class SiteSettingsAdminSerializer(serializers.ModelSerializer):
    ai_api_key_openai_meta = serializers.SerializerMethodField()
    ai_api_key_anthropic_meta = serializers.SerializerMethodField()

    class Meta:
        model = SiteSettings
        fields = [
            "require_email_verification",
            "logged_in_users_only_default",
            "ai_provider",
            "ai_model_openai",
            "ai_model_anthropic",
            "ai_api_key_openai_meta",
            "ai_api_key_anthropic_meta",
        ]

    def get_ai_api_key_openai_meta(self, obj):
        return {
            "configured": bool(obj.ai_api_key_openai),
            "masked_value": mask_secret(obj.ai_api_key_openai),
        }

    def get_ai_api_key_anthropic_meta(self, obj):
        return {
            "configured": bool(obj.ai_api_key_anthropic),
            "masked_value": mask_secret(obj.ai_api_key_anthropic),
        }


class SiteSettingsUpdateSerializer(serializers.Serializer):
    require_email_verification = serializers.BooleanField(required=False)
    logged_in_users_only_default = serializers.BooleanField(required=False)
    ai_provider = serializers.ChoiceField(
        choices=SiteSettings.AIProvider.choices,
        required=False,
    )
    ai_model_openai = serializers.CharField(required=False, allow_blank=True, max_length=100)
    ai_model_anthropic = serializers.CharField(required=False, allow_blank=True, max_length=100)
    ai_api_key_openai = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    ai_api_key_anthropic = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)


class AITestRequestSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=SiteSettings.AIProvider.choices)
    model = serializers.CharField(max_length=100)
    api_key = serializers.CharField(allow_blank=False, trim_whitespace=True)


class PasswordResetValidateSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError(
                {"new_password": "Password fields didn't match."}
            )
        return attrs
