from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from uuid import uuid4
from tempfile import TemporaryDirectory

from surveys.models import Choice, Page, Question, Survey

User = get_user_model()


class SurveyCrudTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="TestPass123!",
        )
        self.other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(self.user)

    def _create_survey_with_structure(self, owner):
        survey = Survey.objects.create(
            user=owner,
            title="Customer Feedback",
            description="Initial draft",
            settings={"progress_bar": True},
        )
        page = Page.objects.create(survey=survey, title="Page 1", order=1)
        question = Question.objects.create(
            page=page,
            question_type=Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
            text="How was your experience?",
            order=1,
            settings={"allow_other": True},
        )
        Choice.objects.create(question=question, text="Great", order=1, score=5)
        Choice.objects.create(question=question, text="Okay", order=2, score=3)
        return survey

    def test_create_list_retrieve_update_delete_survey(self):
        Survey.objects.create(user=self.other_user, title="Other Survey")

        create_response = self.client.post(
            "/api/surveys/",
            {
                "title": "Product Research",
                "description": "Q1 survey",
                "theme": {"primary": "#111111"},
                "settings": {"progress_bar": True},
                "welcome_page": {"enabled": True},
                "thank_you_page": {"enabled": True},
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_survey_id = create_response.data["id"]
        self.assertEqual(create_response.data["theme"]["primary_color"], "#111111")
        self.assertEqual(create_response.data["theme"]["background_color"], "#ffffff")
        self.assertEqual(create_response.data["theme"]["font_family"], "Inter")

        list_response = self.client.get("/api/surveys/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data["results"]), 1)
        self.assertEqual(list_response.data["results"][0]["id"], str(created_survey_id))

        retrieve_response = self.client.get(f"/api/surveys/{created_survey_id}/")
        self.assertEqual(retrieve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(retrieve_response.data["title"], "Product Research")

        update_response = self.client.patch(
            f"/api/surveys/{created_survey_id}/",
            {"title": "Updated Product Research"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["title"], "Updated Product Research")

        delete_response = self.client.delete(f"/api/surveys/{created_survey_id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Survey.objects.filter(id=created_survey_id).exists())

    def test_update_survey_normalizes_rich_theme_schema(self):
        survey = Survey.objects.create(user=self.user, title="Theme Test")

        response = self.client.patch(
            f"/api/surveys/{survey.id}/",
            {
                "theme": {
                    "primary_color": "#123abc",
                    "background_color": "#faf7f2",
                    "text_color": "#152033",
                    "font_family": "Lato",
                    "button_style": "pill",
                    "progress_bar_color": "#2dd4bf",
                    "logo_position": "center",
                    "question_spacing": "spacious",
                    "background_image_opacity": 0.44,
                }
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["theme"]["primary_color"], "#123abc")
        self.assertEqual(response.data["theme"]["font_family"], "Lato")
        self.assertEqual(response.data["theme"]["button_style"], "pill")
        self.assertEqual(response.data["theme"]["background_image_opacity"], 0.44)

    def test_theme_asset_upload_action_updates_theme_urls(self):
        survey = Survey.objects.create(user=self.user, title="Asset Survey")

        with TemporaryDirectory() as temp_dir:
            with override_settings(MEDIA_ROOT=temp_dir):
                upload = SimpleUploadedFile(
                    "logo.png",
                    b"fake-image-data",
                    content_type="image/png",
                )

                upload_response = self.client.post(
                    f"/api/surveys/{survey.id}/theme-assets/",
                    {
                        "asset_type": "logo",
                        "asset": upload,
                    },
                    format="multipart",
                )

                self.assertEqual(upload_response.status_code, status.HTTP_200_OK)
                self.assertIn("/media/survey-theme-assets/", upload_response.data["url"])
                survey.refresh_from_db()
                self.assertEqual(survey.theme["logo_url"], upload_response.data["url"])

                clear_response = self.client.post(
                    f"/api/surveys/{survey.id}/theme-assets/",
                    {
                        "asset_type": "logo",
                        "clear": "true",
                    },
                    format="multipart",
                )

                self.assertEqual(clear_response.status_code, status.HTTP_200_OK)
                survey.refresh_from_db()
                self.assertEqual(survey.theme["logo_url"], "")

    def test_duplicate_action_deep_copies_pages_questions_and_choices(self):
        survey = self._create_survey_with_structure(self.user)

        response = self.client.post(
            f"/api/surveys/{survey.id}/duplicate/", format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        duplicated = Survey.objects.exclude(id=survey.id).get()
        original_page = survey.pages.get()
        duplicated_page = duplicated.pages.get()
        original_question = original_page.questions.get()
        duplicated_question = duplicated_page.questions.get()

        self.assertEqual(duplicated.title, "Customer Feedback (Copy)")
        self.assertEqual(duplicated.status, Survey.Status.DRAFT)
        self.assertEqual(duplicated.pages.count(), 1)
        self.assertEqual(duplicated_page.questions.count(), 1)
        self.assertEqual(duplicated_question.choices.count(), 2)
        self.assertNotEqual(duplicated.id, survey.id)
        self.assertNotEqual(duplicated_page.id, original_page.id)
        self.assertNotEqual(duplicated_question.id, original_question.id)
        self.assertEqual(duplicated_question.settings["allow_other"], True)

    def test_update_question_preserves_supplied_choice_ids_for_new_choices(self):
        survey = self._create_survey_with_structure(self.user)
        page = survey.pages.get()
        question = page.questions.get()
        existing_choice = question.choices.order_by("order").first()
        new_choice_id = uuid4()

        response = self.client.put(
            f"/api/surveys/{survey.id}/pages/{page.id}/questions/{question.id}/",
            {
                "question_type": question.question_type,
                "text": question.text,
                "description": question.description,
                "required": question.required,
                "order": question.order,
                "settings": question.settings,
                "skip_logic": [
                    {
                        "condition": {"choice_id": str(new_choice_id)},
                        "action": "end_survey",
                        "target": "",
                    }
                ],
                "choices": [
                    {
                        "id": str(existing_choice.id),
                        "text": existing_choice.text,
                        "order": existing_choice.order,
                        "score": existing_choice.score,
                    },
                    {
                        "id": str(new_choice_id),
                        "text": "New option",
                        "order": 2,
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(question.choices.filter(id=new_choice_id, text="New option").exists())

        question.refresh_from_db()
        self.assertEqual(
            question.skip_logic[0]["condition"]["choice_id"],
            str(new_choice_id),
        )
