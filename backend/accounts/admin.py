from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model
from django.http import HttpResponseRedirect
from django.urls import reverse

from .models import EmailVerificationToken, SiteSettings

User = get_user_model()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for custom User model."""

    list_display = [
        "username",
        "email",
        "first_name",
        "last_name",
        "organization",
        "designation",
        "email_verified",
        "is_staff",
        "created_at",
    ]
    list_filter = ["is_staff", "is_superuser", "is_active", "email_verified", "created_at"]
    search_fields = [
        "username",
        "email",
        "first_name",
        "last_name",
        "organization",
        "designation",
        "phone",
    ]
    ordering = ["-created_at"]

    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Additional Info",
            {
                "fields": (
                    "bio",
                    "avatar",
                    "organization",
                    "designation",
                    "phone",
                    "email_verified",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    readonly_fields = ["created_at", "updated_at"]
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            "Additional Info",
            {
                "fields": (
                    "email",
                    "bio",
                    "avatar",
                    "organization",
                    "designation",
                    "phone",
                    "email_verified",
                )
            },
        ),
    )


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    """Admin interface for singleton site settings."""

    list_display = [
        "require_email_verification",
        "logged_in_users_only_default",
        "ai_provider",
        "updated_at",
    ]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        (
            "Authentication",
            {"fields": ("require_email_verification", "logged_in_users_only_default")},
        ),
        (
            "AI settings",
            {
                "fields": (
                    "ai_provider",
                    "ai_model_openai",
                    "ai_model_anthropic",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )

    def has_add_permission(self, request):
        if SiteSettings.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        if SiteSettings.objects.exists():
            object_id = SiteSettings.objects.first().pk
            url = reverse("admin:accounts_sitesettings_change", args=[object_id])
            return HttpResponseRedirect(url)
        return super().changelist_view(request, extra_context)


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    """Read-only operational visibility for verification tokens."""

    list_display = ["user", "token", "used", "created_at", "expires_at"]
    list_filter = ["used", "created_at", "expires_at"]
    search_fields = ["user__username", "user__email", "token"]
    readonly_fields = ["id", "user", "token", "used", "created_at", "expires_at"]

    def has_add_permission(self, request):
        return False
