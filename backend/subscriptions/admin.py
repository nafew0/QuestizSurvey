from django.contrib import admin

from .models import Plan, UserSubscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "tier",
        "max_surveys",
        "max_questions_per_survey",
        "max_responses_per_survey",
        "price_monthly",
        "price_yearly",
        "is_active",
    ]
    list_filter = ["is_active", "currency", "tier"]
    search_fields = ["name", "slug"]
    ordering = ["tier"]


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "plan",
        "status",
        "billing_cycle",
        "payment_provider",
        "current_period_end",
        "updated_at",
    ]
    list_filter = ["status", "billing_cycle", "payment_provider", "plan"]
    search_fields = ["user__username", "user__email", "stripe_customer_id", "stripe_subscription_id"]
    autocomplete_fields = ["user", "plan"]

