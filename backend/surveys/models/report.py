import uuid

from django.conf import settings
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.core.exceptions import ValidationError
from django.db import models


class SavedReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.ForeignKey(
        "surveys.Survey",
        on_delete=models.CASCADE,
        related_name="saved_reports",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_reports",
    )
    name = models.CharField(max_length=255)
    config = models.JSONField(default=dict, blank=True)
    is_shared = models.BooleanField(default=False)
    share_password = models.CharField(max_length=128, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name

    def has_share_password(self):
        return bool(self.share_password)

    def set_share_password(self, raw_password):
        if not raw_password:
            self.share_password = ""
            return
        self.share_password = make_password(raw_password)

    def check_share_password(self, raw_password):
        if not self.share_password:
            return True

        try:
            identify_hasher(self.share_password)
        except (ValueError, TypeError, ValidationError):
            return self.share_password == raw_password

        return check_password(raw_password, self.share_password)
