from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from surveys.models import Answer, Choice, Collector, Page, Question, SavedReport, Survey, SurveyResponse

User = get_user_model()


class SharedReportsApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reports-owner",
            email="reports-owner@example.com",
            password="TestPass123!",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.survey = Survey.objects.create(
            user=self.user,
            title="Quarterly CX",
            status=Survey.Status.ACTIVE,
        )
        self.page = Page.objects.create(survey=self.survey, title="Page 1", order=1)
        self.collector = Collector.objects.create(
            survey=self.survey,
            type=Collector.CollectorType.WEB_LINK,
            name="Web Link",
            status=Collector.Status.OPEN,
        )
        self.question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
            text="How was your experience?",
            order=1,
        )
        self.choice_good = Choice.objects.create(
            question=self.question,
            text="Good",
            order=1,
        )
        self.choice_bad = Choice.objects.create(
            question=self.question,
            text="Bad",
            order=2,
        )

        self.response = SurveyResponse.objects.create(
            survey=self.survey,
            collector=self.collector,
            status=SurveyResponse.Status.COMPLETED,
        )
        Answer.objects.create(
            response=self.response,
            question=self.question,
            choice_ids=[str(self.choice_good.id)],
        )

    def test_saved_report_serializer_returns_share_metadata(self):
        response = self.client.post(
            f"/api/surveys/{self.survey.id}/reports/",
            {
                "name": "Leadership readout",
                "is_shared": True,
                "share_password": "Secret123!",
                "config": {
                    "filters": {"status": "completed"},
                    "cross_tabs": [],
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = SavedReport.objects.get(id=response.data["id"])
        self.assertTrue(report.is_shared)
        self.assertTrue(report.check_share_password("Secret123!"))
        self.assertNotEqual(report.share_password, "Secret123!")
        self.assertTrue(response.data["has_share_password"])
        self.assertIn(f"/reports/{report.id}", response.data["public_url"])

    def test_public_report_endpoint_requires_password_then_uses_session(self):
        report = SavedReport.objects.create(
            survey=self.survey,
            user=self.user,
            name="Board pack",
            is_shared=True,
            config={
                "filters": {"status": "completed"},
                "card_preferences": {
                    str(self.question.id): {
                        "chartType": "pie",
                        "colorScheme": "warm",
                    }
                },
            },
        )
        report.set_share_password("Opensesame")
        report.save(update_fields=["share_password"])

        public_client = APIClient()

        locked_response = public_client.get(f"/api/reports/{report.id}/data/")
        self.assertEqual(locked_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(locked_response.data["code"], "password_required")

        unlocked_response = public_client.get(
            f"/api/reports/{report.id}/data/",
            {"password": "Opensesame"},
        )
        self.assertEqual(unlocked_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unlocked_response.data["report"]["name"], "Board pack")
        self.assertEqual(
            unlocked_response.data["report"]["config"]["card_preferences"][str(self.question.id)]["chartType"],
            "pie",
        )

        session_response = public_client.get(f"/api/reports/{report.id}/data/")
        self.assertEqual(session_response.status_code, status.HTTP_200_OK)

    def test_public_report_endpoint_returns_not_found_for_private_report(self):
        report = SavedReport.objects.create(
            survey=self.survey,
            user=self.user,
            name="Private draft",
            is_shared=False,
            config={},
        )

        response = APIClient().get(f"/api/reports/{report.id}/data/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
