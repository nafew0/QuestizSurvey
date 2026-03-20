from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from surveys.models import Answer, Choice, Page, Question, Survey, SurveyResponse
from surveys.throttles import PublicSurveyWriteThrottle

User = get_user_model()

TEST_CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "public-survey-tests",
    }
}


@override_settings(CACHES=TEST_CACHES)
class PublicSurveyTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(
            username="publisher",
            email="publisher@example.com",
            password="TestPass123!",
        )
        self.respondent = User.objects.create_user(
            username="respondent",
            email="respondent@example.com",
            password="TestPass123!",
        )
        self.other_user = User.objects.create_user(
            username="other-user",
            email="other@example.com",
            password="TestPass123!",
        )
        self.authenticated_client = APIClient()
        self.authenticated_client.force_authenticate(self.owner)
        self.respondent_client = APIClient()
        self.respondent_client.force_authenticate(self.respondent)
        self.other_client = APIClient()
        self.other_client.force_authenticate(self.other_user)
        self.public_client = APIClient()

        self.survey = Survey.objects.create(
            user=self.owner,
            title="Published Survey",
            status=Survey.Status.ACTIVE,
        )
        self.page = Page.objects.create(survey=self.survey, title="Page 1", order=1)
        self.question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
            text="Pick one option",
            order=1,
        )
        self.choice = Choice.objects.create(
            question=self.question, text="Option A", order=1
        )
        Choice.objects.create(question=self.question, text="Option B", order=2)

    def test_public_fetch_and_submit_completed_response(self):
        get_response = self.public_client.get(
            f"/api/public/surveys/{self.survey.slug}/"
        )
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["title"], "Published Survey")
        self.assertEqual(len(get_response.data["pages"]), 1)

        post_response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "respondent_email": "respondent@example.com",
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.question.id),
                        "choice_ids": [str(self.choice.id)],
                        "comment_text": "Loved it",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(post_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(post_response.data["status"], SurveyResponse.Status.COMPLETED)
        self.assertTrue(post_response.data["resume_token"])

        survey_response = SurveyResponse.objects.get(survey=self.survey)
        answer = Answer.objects.get(response=survey_response, question=self.question)

        self.assertEqual(answer.choice_ids, [str(self.choice.id)])
        self.assertEqual(answer.comment_text, "Loved it")
        self.assertIsNotNone(survey_response.completed_at)

    def test_public_submission_accepts_open_ended_with_other_row(self):
        question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.OPEN_ENDED,
            text="What is your internet BW?",
            order=2,
            settings={
                "rows": ["Commodity", "NIX", "Intranet"],
                "allow_other": True,
            },
        )

        response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(question.id),
                        "matrix_data": {
                            "Commodity": "100 Mbps",
                            "NIX": "50 Mbps",
                            "Intranet": "1 Gbps",
                            "__other__": "Cache",
                        },
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        answer = Answer.objects.get(question=question)
        self.assertEqual(answer.matrix_data["Commodity"], "100 Mbps")
        self.assertEqual(answer.matrix_data["__other__"], "Cache")

    def test_public_submission_accepts_matrix_plus_cells(self):
        question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MATRIX_PLUS,
            text="List",
            order=2,
            settings={
                "rows": ["Item 1", "Item 2"],
                "columns": ["Col1", "Col2"],
                "dropdown_options": ["Ddown1", "Ddown2", "Ddown3"],
            },
        )

        response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(question.id),
                        "matrix_data": {
                            "Item 1": {
                                "Col1": "Ddown1",
                                "Col2": "Ddown2",
                            },
                            "Item 2": {
                                "Col1": "Ddown3",
                                "Col2": "Ddown1",
                            },
                        },
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        answer = Answer.objects.get(question=question)
        self.assertEqual(answer.matrix_data["Item 1"]["Col1"], "Ddown1")
        self.assertEqual(answer.matrix_data["Item 2"]["Col2"], "Ddown1")

    def test_completed_submission_rejects_missing_required_open_ended_rows(self):
        question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.OPEN_ENDED,
            text="Bandwidth check",
            order=2,
            required=True,
            settings={
                "rows": ["Commodity", "NIX"],
                "allow_other": True,
            },
        )

        response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(question.id),
                        "matrix_data": {
                            "Commodity": "100 Mbps",
                        },
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("answers", response.data)

    def test_completed_submission_rejects_missing_required_matrix_plus_cells(self):
        question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MATRIX_PLUS,
            text="Matrix+ check",
            order=2,
            required=True,
            settings={
                "rows": ["Item 1", "Item 2"],
                "columns": ["Col1", "Col2"],
                "dropdown_options": ["Yes", "No"],
            },
        )

        response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(question.id),
                        "matrix_data": {
                            "Item 1": {
                                "Col1": "Yes",
                                "Col2": "No",
                            },
                            "Item 2": {
                                "Col1": "Yes",
                            },
                        },
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("answers", response.data)

    def test_logged_in_only_public_survey_requires_authentication(self):
        self.survey.settings = {"require_login": True}
        self.survey.save(update_fields=["settings", "updated_at"])

        response = self.public_client.get(f"/api/public/surveys/{self.survey.slug}/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(response.data["require_login"])
        self.assertEqual(response.data["code"], "login_required")

    def test_logged_in_only_public_submission_requires_authentication(self):
        self.survey.settings = {"require_login": True}
        self.survey.save(update_fields=["settings", "updated_at"])

        response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.question.id),
                        "choice_ids": [str(self.choice.id)],
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(response.data["require_login"])
        self.assertEqual(response.data["code"], "login_required")

    def test_logged_in_only_survey_allows_authenticated_submission_and_binds_user(self):
        self.survey.settings = {"require_login": True}
        self.survey.save(update_fields=["settings", "updated_at"])

        get_response = self.respondent_client.get(
            f"/api/public/surveys/{self.survey.slug}/"
        )
        post_response = self.respondent_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "respondent_email": "spoof@example.com",
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.question.id),
                        "choice_ids": [str(self.choice.id)],
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(post_response.status_code, status.HTTP_201_CREATED)

        survey_response = SurveyResponse.objects.get(survey=self.survey)
        self.assertEqual(survey_response.user, self.respondent)
        self.assertEqual(survey_response.respondent_email, self.respondent.email)

    def test_logged_in_only_resume_token_cannot_be_used_by_different_user(self):
        self.survey.settings = {"require_login": True}
        self.survey.save(update_fields=["settings", "updated_at"])

        created_response = self.respondent_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "status": SurveyResponse.Status.IN_PROGRESS,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.question.id),
                        "choice_ids": [str(self.choice.id)],
                    }
                ],
            },
            format="json",
        )
        resume_token = created_response.data["resume_token"]

        response = self.other_client.put(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "resume_token": resume_token,
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.question.id),
                        "choice_ids": [str(self.choice.id)],
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["code"], "invalid_resume")

    def test_logged_in_only_single_response_blocks_same_user_repeat_submission(self):
        self.survey.settings = {
            "require_login": True,
            "allow_multiple": False,
        }
        self.survey.save(update_fields=["settings", "updated_at"])

        first_response = self.respondent_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.question.id),
                        "choice_ids": [str(self.choice.id)],
                    }
                ],
            },
            format="json",
        )
        second_response = self.respondent_client.get(
            f"/api/public/surveys/{self.survey.slug}/"
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(second_response.data["code"], "already_completed")

    def test_public_submission_throttle_blocks_after_limit(self):
        with patch.object(PublicSurveyWriteThrottle, "rate", "1/min"):
            first_response = self.public_client.post(
                f"/api/public/surveys/{self.survey.slug}/",
                {
                    "status": SurveyResponse.Status.IN_PROGRESS,
                    "current_page": str(self.page.id),
                    "answers": [
                        {
                            "question": str(self.question.id),
                            "choice_ids": [str(self.choice.id)],
                        }
                    ],
                },
                format="json",
            )
            second_response = self.public_client.post(
                f"/api/public/surveys/{self.survey.slug}/",
                {
                    "status": SurveyResponse.Status.IN_PROGRESS,
                    "current_page": str(self.page.id),
                    "answers": [
                        {
                            "question": str(self.question.id),
                            "choice_ids": [str(self.choice.id)],
                        }
                    ],
                },
                format="json",
            )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_public_update_throttle_blocks_after_limit(self):
        with patch.object(PublicSurveyWriteThrottle, "rate", "1/min"):
            start_response = self.public_client.post(
                f"/api/public/surveys/{self.survey.slug}/",
                {
                    "status": SurveyResponse.Status.IN_PROGRESS,
                    "current_page": str(self.page.id),
                    "answers": [
                        {
                            "question": str(self.question.id),
                            "choice_ids": [str(self.choice.id)],
                        }
                    ],
                },
                format="json",
            )
            update_response = self.public_client.put(
                f"/api/public/surveys/{self.survey.slug}/",
                {
                    "resume_token": start_response.data["resume_token"],
                    "status": SurveyResponse.Status.COMPLETED,
                    "current_page": str(self.page.id),
                    "answers": [
                        {
                            "question": str(self.question.id),
                            "choice_ids": [str(self.choice.id)],
                        }
                    ],
                },
                format="json",
            )

        self.assertEqual(start_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(update_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_public_load_is_not_throttled_when_write_limit_is_exceeded(self):
        with patch.object(PublicSurveyWriteThrottle, "rate", "1/min"):
            start_response = self.public_client.post(
                f"/api/public/surveys/{self.survey.slug}/",
                {
                    "status": SurveyResponse.Status.IN_PROGRESS,
                    "current_page": str(self.page.id),
                    "answers": [
                        {
                            "question": str(self.question.id),
                            "choice_ids": [str(self.choice.id)],
                        }
                    ],
                },
                format="json",
            )
            throttled_response = self.public_client.post(
                f"/api/public/surveys/{self.survey.slug}/",
                {
                    "status": SurveyResponse.Status.IN_PROGRESS,
                    "current_page": str(self.page.id),
                    "answers": [
                        {
                            "question": str(self.question.id),
                            "choice_ids": [str(self.choice.id)],
                        }
                    ],
                },
                format="json",
            )
            load_response = self.public_client.post(
                f"/api/public/surveys/{self.survey.slug}/load/",
                {"resume_token": start_response.data["resume_token"]},
                format="json",
            )

        self.assertEqual(start_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(throttled_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(load_response.status_code, status.HTTP_200_OK)
