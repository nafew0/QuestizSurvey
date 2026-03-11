from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from surveys.models import Page, Question, Survey, SurveyResponse

User = get_user_model()


class SaveAndContinueTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="resume-owner",
            email="resume-owner@example.com",
            password="TestPass123!",
        )
        self.public_client = APIClient()
        self.survey = Survey.objects.create(
            user=self.owner,
            title="Resume Survey",
            status=Survey.Status.ACTIVE,
        )
        self.page = Page.objects.create(survey=self.survey, title="Page 1", order=1)
        self.question_one = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.SHORT_TEXT,
            text="What is your role?",
            order=1,
        )
        self.question_two = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.LONG_TEXT,
            text="Tell us more",
            order=2,
        )
        self.open_ended_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.OPEN_ENDED,
            text="Bandwidth blocks",
            order=3,
            settings={
                "rows": ["Commodity", "NIX"],
                "allow_other": True,
            },
        )
        self.matrix_plus_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MATRIX_PLUS,
            text="Matrix+",
            order=4,
            settings={
                "rows": ["Item 1", "Item 2"],
                "columns": ["Col1", "Col2"],
                "dropdown_options": ["Yes", "No"],
            },
        )

    def test_save_partial_response_resume_and_complete(self):
        start_response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "status": SurveyResponse.Status.IN_PROGRESS,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.question_one.id),
                        "text_value": "Designer",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(start_response.status_code, status.HTTP_201_CREATED)

        resume_token = start_response.data["resume_token"]
        survey_response_id = start_response.data["id"]

        resume_response = self.public_client.get(
            f"/api/public/surveys/{self.survey.slug}/?resume_token={resume_token}"
        )
        self.assertEqual(resume_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resume_response.data["response"]["id"], str(survey_response_id)
        )
        self.assertEqual(
            resume_response.data["response"]["answers"][0]["text_value"], "Designer"
        )

        complete_response = self.public_client.put(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "resume_token": resume_token,
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.question_one.id),
                        "text_value": "Senior Designer",
                    },
                    {
                        "question": str(self.question_two.id),
                        "text_value": "Working on survey UX",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(complete_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            complete_response.data["status"], SurveyResponse.Status.COMPLETED
        )
        self.assertEqual(len(complete_response.data["answers"]), 2)

        survey_response = SurveyResponse.objects.get(id=survey_response_id)
        self.assertEqual(survey_response.resume_token, resume_token)
        self.assertEqual(survey_response.status, SurveyResponse.Status.COMPLETED)
        self.assertIsNotNone(survey_response.completed_at)
        self.assertIsNotNone(survey_response.duration_seconds)
        self.assertEqual(survey_response.answers.count(), 2)
        self.assertEqual(
            survey_response.answers.get(question=self.question_one).text_value,
            "Senior Designer",
        )

    def test_save_and_resume_preserves_open_ended_and_matrix_plus_answers(self):
        start_response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "status": SurveyResponse.Status.IN_PROGRESS,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.open_ended_question.id),
                        "matrix_data": {
                            "Commodity": "100 Mbps",
                            "NIX": "50 Mbps",
                            "__other__": "Cache",
                        },
                    },
                    {
                        "question": str(self.matrix_plus_question.id),
                        "matrix_data": {
                            "Item 1": {
                                "Col1": "Yes",
                                "Col2": "No",
                            },
                            "Item 2": {
                                "Col1": "No",
                                "Col2": "Yes",
                            },
                        },
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(start_response.status_code, status.HTTP_201_CREATED)

        resume_token = start_response.data["resume_token"]

        resume_response = self.public_client.get(
            f"/api/public/surveys/{self.survey.slug}/?resume_token={resume_token}"
        )
        self.assertEqual(resume_response.status_code, status.HTTP_200_OK)
        answer_lookup = {
            item["question_id"]: item
            for item in resume_response.data["response"]["answers"]
        }
        self.assertEqual(
            answer_lookup[str(self.open_ended_question.id)]["matrix_data"]["Commodity"],
            "100 Mbps",
        )
        self.assertEqual(
            answer_lookup[str(self.matrix_plus_question.id)]["matrix_data"]["Item 2"]["Col2"],
            "Yes",
        )

        complete_response = self.public_client.put(
            f"/api/public/surveys/{self.survey.slug}/",
            {
                "resume_token": resume_token,
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(self.page.id),
                "answers": [
                    {
                        "question": str(self.open_ended_question.id),
                        "matrix_data": {
                            "Commodity": "150 Mbps",
                            "NIX": "60 Mbps",
                            "__other__": "Cache",
                        },
                    },
                    {
                        "question": str(self.matrix_plus_question.id),
                        "matrix_data": {
                            "Item 1": {
                                "Col1": "Yes",
                                "Col2": "No",
                            },
                            "Item 2": {
                                "Col1": "Yes",
                                "Col2": "No",
                            },
                        },
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(complete_response.status_code, status.HTTP_200_OK)
        survey_response = SurveyResponse.objects.get(id=start_response.data["id"])
        self.assertEqual(
            survey_response.answers.get(question=self.open_ended_question).matrix_data["Commodity"],
            "150 Mbps",
        )
        self.assertEqual(
            survey_response.answers.get(question=self.matrix_plus_question).matrix_data["Item 2"]["Col1"],
            "Yes",
        )
