import uuid

from django.db import models

from surveys.utils import generate_short_token


class EmailInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        OPENED = "opened", "Opened"
        COMPLETED = "completed", "Completed"
        BOUNCED = "bounced", "Bounced"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    collector = models.ForeignKey(
        "surveys.Collector",
        on_delete=models.CASCADE,
        related_name="email_invitations",
    )
    email = models.EmailField()
    status = models.CharField(
        max_length=15, choices=Status.choices, default=Status.PENDING
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    token = models.CharField(max_length=32, unique=True, default=generate_short_token)

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return self.email
