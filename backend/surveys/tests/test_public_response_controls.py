from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from surveys.models import Choice, Page, Question, Survey, SurveyResponse

User = get_user_model()


class PublicResponseControlTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="public-owner",
            email="public-owner@example.com",
            password="TestPass123!",
        )
        self.public_client = APIClient()
        self.survey = Survey.objects.create(
            user=self.owner,
            title="Public Survey",
            status=Survey.Status.ACTIVE,
        )
        self.page = Page.objects.create(survey=self.survey, title="Page 1", order=1)
        self.question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
            text="Pick one",
            order=1,
        )
        self.choice = Choice.objects.create(question=self.question, text="Option A", order=1)

    def submit_payload(self):
        return {
            "status": SurveyResponse.Status.COMPLETED,
            "current_page": str(self.page.id),
            "answers": [
                {
                    "question": str(self.question.id),
                    "choice_ids": [str(self.choice.id)],
                }
            ],
        }

    def test_completed_submission_sets_completion_cookie(self):
        response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            self.submit_payload(),
            format="json",
            REMOTE_ADDR="203.0.113.10",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        cookie = response.cookies.get(f"questiz_responded_{self.survey.slug}")
        self.assertIsNotNone(cookie)
        self.assertEqual(cookie.value, "true")

    def test_multi_response_disabled_blocks_same_ip(self):
        self.survey.settings = {
            "multi_response": False,
        }
        self.survey.save(update_fields=["settings"])

        first_response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            self.submit_payload(),
            format="json",
            REMOTE_ADDR="203.0.113.11",
        )
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        second_response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            self.submit_payload(),
            format="json",
            REMOTE_ADDR="203.0.113.11",
        )
        self.assertEqual(second_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(second_response.data["code"], "already_completed")

    def test_response_limit_blocks_new_public_access(self):
        self.survey.settings = {
            "response_limit": 1,
        }
        self.survey.save(update_fields=["settings"])

        SurveyResponse.objects.create(
            survey=self.survey,
            status=SurveyResponse.Status.COMPLETED,
            completed_at=timezone.now(),
        )

        response = self.public_client.get(f"/api/public/surveys/{self.survey.slug}/")

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.data["code"], "response_limit_reached")

    def test_close_date_blocks_public_access(self):
        self.survey.settings = {
            "close_date": (timezone.now() - timedelta(days=1)).isoformat(),
        }
        self.survey.save(update_fields=["settings"])

        response = self.public_client.get(f"/api/public/surveys/{self.survey.slug}/")

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.data["code"], "survey_closed")

    def test_inactive_survey_returns_explicit_state(self):
        self.survey.status = Survey.Status.CLOSED
        self.survey.save(update_fields=["status"])

        response = self.public_client.get(f"/api/public/surveys/{self.survey.slug}/")

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.data["code"], "survey_inactive")
