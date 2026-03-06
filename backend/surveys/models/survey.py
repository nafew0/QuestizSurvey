import uuid

from django.conf import settings
from django.db import models

from surveys.utils import generate_short_token


class Survey(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        CLOSED = "closed", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="surveys",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    slug = models.CharField(
        max_length=32,
        unique=True,
        default=generate_short_token,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    theme = models.JSONField(default=dict, blank=True)
    settings = models.JSONField(default=dict, blank=True)
    welcome_page = models.JSONField(default=dict, blank=True)
    thank_you_page = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
