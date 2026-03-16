from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from subscriptions.models import Plan, UserSubscription
from surveys.models import Collector, Page, Question, Survey, SurveyResponse

User = get_user_model()


class SubscriptionApiAndLimitsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.public_client = APIClient()
        self.user = User.objects.create_user(
            username="planowner",
            email="planowner@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(self.user)
        self.free_plan = Plan.objects.get(slug="free")

    def create_survey(self, *, title="Survey", owner=None, status=Survey.Status.DRAFT):
        return Survey.objects.create(
            user=owner or self.user,
            title=title,
            status=status,
        )

    def create_page(self, survey, *, order=1):
        return Page.objects.create(
            survey=survey,
            title=f"Page {order}",
            order=order,
        )

    def create_question(self, page, *, order=1, text=None):
        return Question.objects.create(
            page=page,
            question_type=Question.QuestionType.SHORT_TEXT,
            text=text or f"Question {order}",
            order=order,
        )

    def test_plans_endpoint_lists_seeded_active_plans(self):
        response = self.public_client.get("/api/plans/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([plan["slug"] for plan in response.data], ["free", "pro", "enterprise"])
        self.assertIn("bkash_price_monthly", response.data[0])
        self.assertIn("bkash_price_yearly", response.data[0])

    def test_subscription_endpoint_auto_creates_free_subscription(self):
        self.assertFalse(UserSubscription.objects.filter(user=self.user).exists())

        response = self.client.get("/api/subscription/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["plan"]["slug"], "free")
        self.assertTrue(UserSubscription.objects.filter(user=self.user, plan=self.free_plan).exists())

    def test_usage_endpoint_returns_plan_and_usage_snapshot(self):
        self.create_survey(title="Survey A")
        self.create_survey(title="Survey B")

        response = self.client.get("/api/subscription/usage/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["plan"]["slug"], "free")
        self.assertEqual(response.data["surveys"]["used"], 2)
        self.assertEqual(response.data["surveys"]["limit"], self.free_plan.max_surveys)
        self.assertFalse(response.data["surveys"]["unlimited"])

    def test_create_survey_is_blocked_when_plan_limit_is_reached(self):
        self.free_plan.max_surveys = 1
        self.free_plan.save(update_fields=["max_surveys"])
        self.create_survey(title="Existing survey")

        response = self.client.post(
            "/api/surveys/",
            {
                "title": "Blocked survey",
                "description": "Should not be created",
                "theme": {},
                "settings": {},
                "welcome_page": {},
                "thank_you_page": {},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "plan_limit")

    def test_duplicate_survey_is_blocked_when_user_has_no_remaining_slots(self):
        self.free_plan.max_surveys = 1
        self.free_plan.save(update_fields=["max_surveys"])
        survey = self.create_survey(title="Original")

        response = self.client.post(
            f"/api/surveys/{survey.id}/duplicate/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "plan_limit")
        self.assertEqual(Survey.objects.filter(user=self.user).count(), 1)

    def test_create_question_is_blocked_when_plan_question_limit_is_reached(self):
        self.free_plan.max_questions_per_survey = 1
        self.free_plan.save(update_fields=["max_questions_per_survey"])
        survey = self.create_survey(title="Question limited survey")
        page = self.create_page(survey)
        self.create_question(page)

        response = self.client.post(
            f"/api/surveys/{survey.id}/pages/{page.id}/questions/",
            {
                "question_type": Question.QuestionType.SHORT_TEXT,
                "text": "Blocked question",
                "description": "",
                "required": False,
                "order": 2,
                "settings": {},
                "skip_logic": None,
                "choices": [],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "plan_limit")
        self.assertEqual(Question.objects.filter(page=page).count(), 1)

    def test_public_submission_is_blocked_when_plan_response_limit_is_reached(self):
        self.free_plan.max_responses_per_survey = 1
        self.free_plan.save(update_fields=["max_responses_per_survey"])

        survey = self.create_survey(title="Response limited survey", status=Survey.Status.ACTIVE)
        page = self.create_page(survey)
        question = self.create_question(page, text="Your feedback?")
        Collector.objects.create(
            survey=survey,
            type=Collector.CollectorType.WEB_LINK,
            name="Default link",
            status=Collector.Status.OPEN,
        )
        SurveyResponse.objects.create(
            survey=survey,
            status=SurveyResponse.Status.COMPLETED,
            completed_at=timezone.now(),
        )

        response = self.public_client.post(
            f"/api/public/surveys/{survey.slug}/",
            {
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(page.id),
                "answers": [
                    {
                        "question": str(question.id),
                        "text_value": "One more response",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "plan_limit")
