from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from surveys.models import Answer, Choice, Page, Question, Survey, SurveyResponse

User = get_user_model()


class PublicSurveyTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="publisher",
            email="publisher@example.com",
            password="TestPass123!",
        )
        self.authenticated_client = APIClient()
        self.authenticated_client.force_authenticate(self.owner)
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
