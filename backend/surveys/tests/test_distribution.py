from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from surveys.models import Choice, Collector, EmailInvitation, Page, Question, Survey, SurveyResponse

User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="no-reply@questiz.test",
    PUBLIC_APP_URL="http://localhost:5555",
    API_BASE_URL="http://localhost:8000/api",
    CELERY_TASK_ALWAYS_EAGER=True,
)
class DistributionTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="distribution-owner",
            email="distribution-owner@example.com",
            password="TestPass123!",
        )
        self.authenticated_client = APIClient()
        self.authenticated_client.force_authenticate(self.owner)
        self.public_client = APIClient()

        self.survey = Survey.objects.create(
            user=self.owner,
            title="Distribution Survey",
            status=Survey.Status.ACTIVE,
        )
        self.page = Page.objects.create(survey=self.survey, title="Page 1", order=1)
        self.question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
            text="Pick one",
            order=1,
        )
        self.choice = Choice.objects.create(
            question=self.question,
            text="Option A",
            order=1,
        )
        self.web_collector = Collector.objects.create(
            survey=self.survey,
            type=Collector.CollectorType.WEB_LINK,
            name="Web Link",
            status=Collector.Status.OPEN,
        )
        self.email_collector = Collector.objects.create(
            survey=self.survey,
            type=Collector.CollectorType.EMAIL,
            name="Email Invitations",
            status=Collector.Status.OPEN,
        )

    def response_payload(self, **extra):
        payload = {
            "status": SurveyResponse.Status.COMPLETED,
            "current_page": str(self.page.id),
            "answers": [
                {
                    "question": str(self.question.id),
                    "choice_ids": [str(self.choice.id)],
                }
            ],
        }
        payload.update(extra)
        return payload

    def test_send_emails_creates_invitations_and_sends_messages(self):
        response = self.authenticated_client.post(
            f"/api/surveys/{self.survey.id}/collectors/{self.email_collector.id}/send-emails/",
            {
                "emails_text": "alex@example.com\njamie@example.com",
                "subject": "Please take our survey",
                "message": "We would value your feedback.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["queued"], 2)
        self.assertEqual(self.email_collector.email_invitations.count(), 2)
        self.assertEqual(len(mail.outbox), 2)
        self.assertIn("Please take our survey", mail.outbox[0].subject)
        self.assertIn("We would value your feedback.", mail.outbox[0].alternatives[0][0])

        self.email_collector.refresh_from_db()
        self.assertEqual(
            self.email_collector.settings["email_subject"], "Please take our survey"
        )

    def test_send_reminders_queues_existing_invitations(self):
        invitation = EmailInvitation.objects.create(
            collector=self.email_collector,
            email="alex@example.com",
            status=EmailInvitation.Status.SENT,
        )

        response = self.authenticated_client.post(
            f"/api/surveys/{self.survey.id}/collectors/{self.email_collector.id}/send-reminders/",
            {"invitation_ids": [str(invitation.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["queued"], 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(mail.outbox[0].subject.startswith("Reminder:"))

    def test_tracking_pixel_marks_invitation_opened(self):
        invitation = EmailInvitation.objects.create(
            collector=self.email_collector,
            email="alex@example.com",
            status=EmailInvitation.Status.SENT,
        )

        response = self.public_client.get(f"/api/track/open/{invitation.token}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "image/gif")

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, EmailInvitation.Status.OPENED)
        self.assertIsNotNone(invitation.opened_at)

    def test_invitation_completion_links_response_and_marks_completed(self):
        invitation = EmailInvitation.objects.create(
            collector=self.email_collector,
            email="alex@example.com",
            status=EmailInvitation.Status.SENT,
        )

        response = self.public_client.post(
            f"/api/public/surveys/{self.survey.slug}/",
            self.response_payload(invitation_token=invitation.token),
            format="json",
            REMOTE_ADDR="203.0.113.44",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        survey_response = SurveyResponse.objects.get(survey=self.survey)
        self.assertEqual(survey_response.collector, self.email_collector)
        self.assertEqual(survey_response.email_invitation, invitation)

        invitation.refresh_from_db()
        self.assertEqual(invitation.status, EmailInvitation.Status.COMPLETED)
        self.assertIsNotNone(invitation.completed_at)

    def test_password_protected_public_link_requires_access_key(self):
        self.web_collector.settings = {
            "password_enabled": True,
            "password": "secret123",
        }
        self.web_collector.save(update_fields=["settings"])

        blocked = self.public_client.get(f"/api/public/surveys/{self.survey.slug}/")
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(blocked.data["code"], "password_required")

        allowed = self.public_client.get(
            f"/api/public/surveys/{self.survey.slug}/",
            {"access_key": "secret123"},
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
