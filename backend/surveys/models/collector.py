import uuid

from django.db import models


class Collector(models.Model):
    class CollectorType(models.TextChoices):
        WEB_LINK = "web_link", "Web Link"
        EMAIL = "email", "Email"
        EMBED = "embed", "Embed"
        SOCIAL = "social", "Social"
        QR = "qr", "QR"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.ForeignKey(
        "surveys.Survey",
        on_delete=models.CASCADE,
        related_name="collectors",
    )
    type = models.CharField(max_length=20, choices=CollectorType.choices)
    name = models.CharField(max_length=255)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.OPEN
    )
    settings = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
