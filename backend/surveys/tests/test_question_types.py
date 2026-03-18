from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from subscriptions.models import Plan, UserSubscription
from surveys.models import Question, Survey

User = get_user_model()


class QuestionTypeSerializationTests(TestCase):
    choice_based_types = {
        Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
        Question.QuestionType.MULTIPLE_CHOICE_MULTI,
        Question.QuestionType.DROPDOWN,
        Question.QuestionType.YES_NO,
        Question.QuestionType.CONSTANT_SUM,
        Question.QuestionType.RANKING,
        Question.QuestionType.IMAGE_CHOICE,
    }

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="builder",
            email="builder@example.com",
            password="TestPass123!",
        )
        unlimited_plan = Plan.objects.filter(max_questions_per_survey=0).order_by("-tier").first()
        UserSubscription.objects.update_or_create(
            user=self.user,
            defaults={
                "plan": unlimited_plan,
                "status": UserSubscription.Status.ACTIVE,
                "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
                "payment_provider": UserSubscription.PaymentProvider.NONE,
            },
        )
        self.client.force_authenticate(self.user)
        self.survey = Survey.objects.create(user=self.user, title="Question Types")
        page_response = self.client.post(
            f"/api/surveys/{self.survey.id}/pages/",
            {"title": "Intro", "description": "Question catalog", "order": 1},
            format="json",
        )
        self.page_id = page_response.data["id"]

    def _build_payload(self, question_type, order):
        payload = {
            "question_type": question_type,
            "text": f"Question for {question_type}",
            "description": f"Description for {question_type}",
            "required": order % 2 == 0,
            "order": order,
            "settings": {"placeholder": "Sample", "index": order},
        }

        if question_type == Question.QuestionType.MATRIX:
            payload["settings"] = {
                "rows": ["Speed", "Quality"],
                "columns": ["Poor", "Good"],
            }
        elif question_type == Question.QuestionType.MATRIX_PLUS:
            payload["settings"] = {
                "rows": ["Item 1", "Item 2"],
                "columns": ["Col1", "Col2"],
                "dropdown_options": ["Yes", "No"],
            }
        elif question_type == Question.QuestionType.OPEN_ENDED:
            payload["settings"] = {
                "rows": ["Commodity", "NIX"],
                "allow_other": True,
                "allow_comment": False,
            }
        elif question_type == Question.QuestionType.DEMOGRAPHICS:
            payload["settings"] = {"fields": ["age", "location"]}
        elif question_type == Question.QuestionType.DATE_TIME:
            payload["settings"] = {"include_time": True}
        elif question_type in self.choice_based_types:
            payload["choices"] = [
                {"text": "Option A", "order": 1},
                {"text": "Option B", "order": 2},
            ]

        return payload

    def test_all_question_types_roundtrip_through_api(self):
        for order, question_type in enumerate(Question.QuestionType.values, start=1):
            create_response = self.client.post(
                f"/api/surveys/{self.survey.id}/pages/{self.page_id}/questions/",
                self._build_payload(question_type, order),
                format="json",
            )
            self.assertEqual(
                create_response.status_code,
                status.HTTP_201_CREATED,
                msg=f"Failed for {question_type}: {create_response.data}",
            )

        detail_response = self.client.get(f"/api/surveys/{self.survey.id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

        questions = detail_response.data["pages"][0]["questions"]
        serialized_types = {question["question_type"] for question in questions}
        self.assertEqual(serialized_types, set(Question.QuestionType.values))
        self.assertEqual(len(questions), len(Question.QuestionType.values))

        for question in questions:
            if question["question_type"] in self.choice_based_types:
                self.assertEqual(len(question["choices"]), 2)
