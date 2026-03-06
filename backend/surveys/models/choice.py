import uuid

from django.db import models


class Choice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(
        "surveys.Question",
        on_delete=models.CASCADE,
        related_name="choices",
    )
    text = models.TextField()
    image_url = models.URLField(blank=True, null=True)
    is_other = models.BooleanField(default=False)
    order = models.PositiveIntegerField()
    score = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.text[:60]
