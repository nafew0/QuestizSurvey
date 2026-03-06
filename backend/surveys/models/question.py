import uuid

from django.db import models


class Question(models.Model):
    class QuestionType(models.TextChoices):
        MULTIPLE_CHOICE_SINGLE = "multiple_choice_single", "Multiple Choice (Single)"
        MULTIPLE_CHOICE_MULTI = "multiple_choice_multi", "Multiple Choice (Multi)"
        DROPDOWN = "dropdown", "Dropdown"
        SHORT_TEXT = "short_text", "Short Text"
        LONG_TEXT = "long_text", "Long Text"
        YES_NO = "yes_no", "Yes / No"
        RATING_SCALE = "rating_scale", "Rating Scale"
        STAR_RATING = "star_rating", "Star Rating"
        NPS = "nps", "NPS"
        CONSTANT_SUM = "constant_sum", "Constant Sum"
        DATE_TIME = "date_time", "Date / Time"
        MATRIX = "matrix", "Matrix"
        RANKING = "ranking", "Ranking"
        IMAGE_CHOICE = "image_choice", "Image Choice"
        FILE_UPLOAD = "file_upload", "File Upload"
        DEMOGRAPHICS = "demographics", "Demographics"
        SECTION_HEADING = "section_heading", "Section Heading"
        INSTRUCTIONAL_TEXT = "instructional_text", "Instructional Text"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    page = models.ForeignKey(
        "surveys.Page",
        on_delete=models.CASCADE,
        related_name="questions",
    )
    question_type = models.CharField(
        max_length=30,
        choices=QuestionType.choices,
    )
    text = models.TextField()
    description = models.TextField(blank=True)
    required = models.BooleanField(default=False)
    order = models.PositiveIntegerField()
    settings = models.JSONField(default=dict, blank=True)
    skip_logic = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.text[:60]
