from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("surveys", "0002_surveyresponse_email_invitation"),
    ]

    operations = [
        migrations.AlterField(
            model_name="question",
            name="question_type",
            field=models.CharField(
                choices=[
                    ("multiple_choice_single", "Multiple Choice (Single)"),
                    ("multiple_choice_multi", "Multiple Choice (Multi)"),
                    ("dropdown", "Dropdown"),
                    ("short_text", "Short Text"),
                    ("long_text", "Long Text"),
                    ("open_ended", "Open Ended"),
                    ("yes_no", "Yes / No"),
                    ("rating_scale", "Rating Scale"),
                    ("star_rating", "Star Rating"),
                    ("nps", "NPS"),
                    ("constant_sum", "Constant Sum"),
                    ("date_time", "Date / Time"),
                    ("matrix", "Matrix"),
                    ("matrix_plus", "Matrix+"),
                    ("ranking", "Ranking"),
                    ("image_choice", "Image Choice"),
                    ("file_upload", "File Upload"),
                    ("demographics", "Demographics"),
                    ("section_heading", "Section Heading"),
                    ("instructional_text", "Instructional Text"),
                ],
                max_length=30,
            ),
        ),
    ]
