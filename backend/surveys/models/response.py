import uuid

from django.db import models

from surveys.utils import generate_short_token


class SurveyResponse(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.ForeignKey(
        "surveys.Survey",
        on_delete=models.CASCADE,
        related_name="responses",
    )
    collector = models.ForeignKey(
        "surveys.Collector",
        on_delete=models.SET_NULL,
        related_name="responses",
        null=True,
        blank=True,
    )
    respondent_email = models.EmailField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS,
    )
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_active_at = models.DateTimeField(auto_now=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    current_page = models.ForeignKey(
        "surveys.Page",
        on_delete=models.SET_NULL,
        related_name="active_responses",
        null=True,
        blank=True,
    )
    resume_token = models.CharField(
        max_length=32, unique=True, default=generate_short_token
    )

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["survey", "status"]),
            models.Index(fields=["survey", "completed_at"]),
        ]

    def __str__(self):
        return f"{self.survey.title} - {self.status}"
