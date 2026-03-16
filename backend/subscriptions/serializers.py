from rest_framework import serializers

from .models import Plan, UserSubscription


class PlanSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ["name", "slug", "tier"]


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            "id",
            "name",
            "slug",
            "tier",
            "max_surveys",
            "max_questions_per_survey",
            "max_responses_per_survey",
            "price_monthly",
            "price_yearly",
            "bkash_price_monthly",
            "bkash_price_yearly",
            "currency",
            "features",
            "is_active",
        ]


class UserSubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)

    class Meta:
        model = UserSubscription
        fields = [
            "id",
            "plan",
            "status",
            "billing_cycle",
            "payment_provider",
            "current_period_start",
            "current_period_end",
        ]
