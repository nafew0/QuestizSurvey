import secrets
import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


def get_default_verification_expiry():
    return timezone.now() + timedelta(hours=24)


def generate_email_verification_token():
    return secrets.token_hex(32)


class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    Uses UUID as primary key for better security.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    bio = models.TextField(blank=True, null=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    organization = models.CharField(max_length=255, blank=True, default="")
    designation = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Make email required and unique
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-created_at"]

    def __str__(self):
        return self.username

    @property
    def full_name(self):
        """Returns the user's full name."""
        return f"{self.first_name} {self.last_name}".strip() or self.username


class SiteSettings(models.Model):
    """Singleton site-wide settings used by auth and later feature phases."""

    class AIProvider(models.TextChoices):
        OPENAI = "openai", "OpenAI"
        ANTHROPIC = "anthropic", "Anthropic"

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    require_email_verification = models.BooleanField(default=True)
    logged_in_users_only_default = models.BooleanField(default=False)
    ai_provider = models.CharField(
        max_length=20,
        choices=AIProvider.choices,
        default=AIProvider.OPENAI,
    )
    ai_model_openai = models.CharField(max_length=100, blank=True, default="")
    ai_model_anthropic = models.CharField(max_length=100, blank=True, default="")
    ai_api_key_openai = models.CharField(max_length=255, blank=True, default="")
    ai_api_key_anthropic = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Site settings"
        verbose_name_plural = "Site settings"

    def __str__(self):
        return "Site settings"


class EmailVerificationToken(models.Model):
    """Single-use verification token for email verification links."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification_tokens",
    )
    token = models.CharField(
        max_length=64,
        unique=True,
        default=generate_email_verification_token,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=get_default_verification_expiry)
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self):
        return f"Verification token for {self.user.username}"

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()
