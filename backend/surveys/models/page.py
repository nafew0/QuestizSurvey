import uuid

from django.db import models


class Page(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.ForeignKey(
        "surveys.Survey",
        on_delete=models.CASCADE,
        related_name="pages",
    )
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField()
    skip_logic = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["order"]
        unique_together = [("survey", "order")]

    def __str__(self):
        return self.title or f"Page {self.order}"
