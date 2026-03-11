from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from surveys.models import Answer, Page, Question, Survey, SurveyResponse
from surveys.services.lottery import build_lottery_entries

User = get_user_model()


class SurveyLotteryApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="lottery-owner",
            email="lottery-owner@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(self.user)

        self.survey = Survey.objects.create(
            user=self.user,
            title="Prize Draw Survey",
            status=Survey.Status.ACTIVE,
        )
        self.page = Page.objects.create(survey=self.survey, title="Page 1", order=1)
        self.name_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.SHORT_TEXT,
            text="Participant name",
            order=1,
        )
        self.organization_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.SHORT_TEXT,
            text="Organization",
            order=2,
        )
        self.demographics_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.DEMOGRAPHICS,
            text="Identity block",
            order=3,
            settings={
                "fields": {
                    "name": True,
                    "email": True,
                    "city": True,
                }
            },
        )
        self.matrix_plus_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MATRIX_PLUS,
            text="List",
            order=4,
            settings={
                "rows": ["Item 1", "Item 2"],
                "columns": ["Col1", "Col2"],
                "dropdown_options": ["Ddown1", "Ddown2", "Ddown3"],
            },
        )

        self.response_1 = self._create_response(
            "alpha@example.com",
            "Alicia",
            "Northwind",
            {"name": "Alicia", "email": "alpha@example.com", "city": "Dhaka"},
            {
                "Item 1": {"Col1": "Ddown1", "Col2": "Ddown2"},
                "Item 2": {"Col1": "Ddown3", "Col2": "Ddown1"},
            },
        )
        self.response_2 = self._create_response(
            "bravo@example.com",
            "Ben",
            "Fabrikam",
            {"name": "Ben", "email": "bravo@example.com", "city": "Chittagong"},
            {
                "Item 1": {"Col1": "Ddown2", "Col2": "Ddown1"},
                "Item 2": {"Col1": "Ddown3", "Col2": "Ddown2"},
            },
        )

    def _create_response(self, email, name, organization, demographics, matrix_plus):
        response = SurveyResponse.objects.create(
            survey=self.survey,
            status=SurveyResponse.Status.COMPLETED,
            respondent_email=email,
            current_page=self.page,
        )
        Answer.objects.create(
            response=response,
            question=self.name_question,
            text_value=name,
        )
        Answer.objects.create(
            response=response,
            question=self.organization_question,
            text_value=organization,
        )
        Answer.objects.create(
            response=response,
            question=self.demographics_question,
            matrix_data=demographics,
        )
        Answer.objects.create(
            response=response,
            question=self.matrix_plus_question,
            matrix_data=matrix_plus,
        )
        return response

    def test_lottery_get_returns_field_catalog(self):
        response = self.client.get(f"/api/surveys/{self.survey.id}/lottery/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        field_ids = {field["id"] for field in response.data["available_fields"]}
        self.assertIn("response:email", field_ids)
        self.assertIn(f"question:{self.name_question.id}", field_ids)
        self.assertIn(
            f"question:{self.demographics_question.id}:field:name",
            field_ids,
        )
        self.assertEqual(response.data["history"], [])

    def test_lottery_patch_and_draw_persist_winner_history(self):
        save_response = self.client.patch(
            f"/api/surveys/{self.survey.id}/lottery/",
            {
                "selected_fields": [
                    f"question:{self.name_question.id}",
                    f"question:{self.organization_question.id}",
                ],
                "prize_slots": ["First prize", "Second prize"],
                "exclude_previous_winners": True,
            },
            format="json",
        )

        self.assertEqual(save_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            save_response.data["settings"]["selected_fields"],
            [
                f"question:{self.name_question.id}",
                f"question:{self.organization_question.id}",
            ],
        )
        self.assertEqual(save_response.data["stats"]["eligible_entries"], 2)

        first_draw = self.client.post(
            f"/api/surveys/{self.survey.id}/lottery/draw/",
            {"prize_label": "First prize"},
            format="json",
        )
        self.assertEqual(first_draw.status_code, status.HTTP_200_OK)
        self.assertEqual(first_draw.data["draw"]["prize_label"], "First prize")
        self.assertEqual(len(first_draw.data["history"]), 1)

        second_draw = self.client.post(
            f"/api/surveys/{self.survey.id}/lottery/draw/",
            {"prize_label": "Second prize"},
            format="json",
        )
        self.assertEqual(second_draw.status_code, status.HTTP_200_OK)
        self.assertEqual(len(second_draw.data["history"]), 2)
        self.assertNotEqual(
            second_draw.data["history"][0]["response_id"],
            second_draw.data["history"][1]["response_id"],
        )

    def test_lottery_reset_clears_history(self):
        self.survey.settings = {
            "lottery": {
                "selected_fields": [f"question:{self.name_question.id}"],
                "prize_slots": ["First prize"],
                "history": [
                    {
                        "id": "draw-1",
                        "prize_label": "First prize",
                        "response_id": str(self.response_1.id),
                        "entry_label": "Alicia",
                        "selected_values": [
                            {
                                "field_id": f"question:{self.name_question.id}",
                                "label": "Participant name",
                                "value": "Alicia",
                            }
                        ],
                        "drawn_at": "2026-03-11T00:00:00Z",
                    }
                ],
            }
        }
        self.survey.save(update_fields=["settings", "updated_at"])

        response = self.client.post(
            f"/api/surveys/{self.survey.id}/lottery/reset/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["history"], [])

    def test_lottery_entry_label_formats_nested_matrix_plus_answers(self):
        entries = build_lottery_entries(
            self.survey,
            [f"question:{self.matrix_plus_question.id}"],
        )

        self.assertEqual(len(entries), 2)
        entry_labels = [entry["entry_label"] for entry in entries]
        self.assertTrue(
            any("Item 1 / Col1: Ddown1" in label for label in entry_labels)
        )
        self.assertTrue(
            any("Item 2 / Col2:" in label for label in entry_labels)
        )
