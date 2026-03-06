import uuid

from django.db import models


class Answer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    response = models.ForeignKey(
        "surveys.SurveyResponse",
        on_delete=models.CASCADE,
        related_name="answers",
    )
    question = models.ForeignKey(
        "surveys.Question",
        on_delete=models.CASCADE,
        related_name="answers",
    )
    choice_ids = models.JSONField(default=list, blank=True)
    text_value = models.TextField(blank=True)
    numeric_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    date_value = models.DateTimeField(null=True, blank=True)
    file_url = models.URLField(blank=True)
    matrix_data = models.JSONField(null=True, blank=True)
    ranking_data = models.JSONField(null=True, blank=True)
    constant_sum_data = models.JSONField(null=True, blank=True)
    other_text = models.TextField(blank=True)
    comment_text = models.TextField(blank=True)
    answered_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("response", "question")]

    def __str__(self):
        return f"{self.response_id} - {self.question_id}"
