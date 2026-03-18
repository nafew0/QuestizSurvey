from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import SiteSettings
from surveys.models import Page, Question, Survey
from surveys.services.ai_service import (
    AIService,
    AIServiceConfigurationError,
    AIServiceRequestError,
)

User = get_user_model()

TEST_CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}


@override_settings(CACHES=TEST_CACHES)
class AIQuestionImproverServiceTests(TestCase):
    def setUp(self):
        SiteSettings.objects.update_or_create(
            pk=1,
            defaults={
                "require_email_verification": True,
                "logged_in_users_only_default": False,
                "ai_provider": SiteSettings.AIProvider.OPENAI,
                "ai_model_openai": "gpt-5-mini",
                "ai_model_anthropic": "claude-3-7-sonnet-latest",
                "ai_api_key_openai": "openai-test-key",
                "ai_api_key_anthropic": "anthropic-test-key",
            },
        )

    def test_openai_call_returns_output_text(self):
        service = AIService()

        with patch.object(
            service,
            "_request_json",
            return_value={
                "status": "completed",
                "output_text": "Improved question text",
            },
        ):
            result = service.call("system", "user")

        self.assertEqual(result, "Improved question text")

    def test_openai_call_accepts_incomplete_status_when_text_exists(self):
        service = AIService()

        with patch.object(
            service,
            "_request_json",
            return_value={
                "status": "incomplete",
                "incomplete_details": {"reason": "max_output_tokens"},
                "output_text": "Improved question text",
            },
        ):
            result = service.call("system", "user")

        self.assertEqual(result, "Improved question text")

    def test_openai_call_reads_text_from_output_array_when_output_text_missing(self):
        service = AIService()

        with patch.object(
            service,
            "_request_json",
            return_value={
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {"type": "output_text", "text": "Improved question text"}
                        ],
                    }
                ],
            },
        ):
            result = service.call("system", "user")

        self.assertEqual(result, "Improved question text")

    def test_anthropic_call_returns_joined_text_blocks(self):
        SiteSettings.objects.filter(pk=1).update(
            ai_provider=SiteSettings.AIProvider.ANTHROPIC
        )
        service = AIService()

        with patch.object(
            service,
            "_request_json",
            return_value={
                "id": "msg_123",
                "content": [
                    {"type": "text", "text": "Improved"},
                    {"type": "text", "text": "question"},
                ],
            },
        ):
            result = service.call("system", "user")

        self.assertEqual(result, "Improved\nquestion")

    def test_improve_question_rejects_blank_text(self):
        service = AIService()

        with self.assertRaises(AIServiceRequestError):
            service.improve_question("Customer Survey", "Short Text", "   ")


@override_settings(CACHES=TEST_CACHES)
class AIQuestionImproverEndpointTests(TestCase):
    def setUp(self):
        SiteSettings.objects.update_or_create(
            pk=1,
            defaults={
                "require_email_verification": True,
                "logged_in_users_only_default": False,
                "ai_provider": SiteSettings.AIProvider.OPENAI,
                "ai_model_openai": "gpt-5-mini",
                "ai_model_anthropic": "",
                "ai_api_key_openai": "openai-test-key",
                "ai_api_key_anthropic": "",
            },
        )

        self.user = User.objects.create_user(
            username="builder",
            email="builder@example.com",
            password="TestPass123!",
            email_verified=True,
        )
        self.other_user = User.objects.create_user(
            username="other-builder",
            email="other-builder@example.com",
            password="TestPass123!",
            email_verified=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.other_client = APIClient()
        self.other_client.force_authenticate(self.other_user)

        self.survey = Survey.objects.create(
            user=self.user,
            title="Customer Experience Survey",
            status=Survey.Status.DRAFT,
        )
        self.page = Page.objects.create(survey=self.survey, title="Page 1", order=1)
        self.question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.SHORT_TEXT,
            text="How was our service?",
            order=1,
        )
        self.improve_url = (
            f"/api/surveys/{self.survey.id}/pages/{self.page.id}/questions/"
            f"{self.question.id}/improve/"
        )

    @patch("surveys.views.question_views.AIService.improve_question")
    def test_question_improve_returns_improved_text(self, improve_question_mock):
        improve_question_mock.return_value = (
            "How would you describe your experience with our service?"
        )

        response = self.client.post(self.improve_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["improved_text"],
            "How would you describe your experience with our service?",
        )
        improve_question_mock.assert_called_once_with(
            self.survey.title,
            self.question.get_question_type_display(),
            self.question.text,
        )

    @patch("surveys.views.question_views.AIService.improve_question")
    def test_question_improve_uses_draft_text_when_provided(self, improve_question_mock):
        improve_question_mock.return_value = "What stood out most about your experience?"

        response = self.client.post(
            self.improve_url,
            {"draft_text": "What do you think of the service you received today?"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        improve_question_mock.assert_called_once_with(
            self.survey.title,
            self.question.get_question_type_display(),
            "What do you think of the service you received today?",
        )

    @patch("surveys.views.question_views.AIService.improve_question")
    def test_question_improve_requires_owner_access(self, improve_question_mock):
        response = self.other_client.post(self.improve_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        improve_question_mock.assert_not_called()

    @patch("surveys.views.question_views.AIService.improve_question")
    def test_question_improve_returns_503_for_missing_configuration(
        self,
        improve_question_mock,
    ):
        improve_question_mock.side_effect = AIServiceConfigurationError(
            "OpenAI API key is not configured."
        )

        response = self.client.post(self.improve_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("not configured", response.data["detail"])

    @patch("surveys.views.question_views.AIService.improve_question")
    def test_question_improve_is_rate_limited(self, improve_question_mock):
        improve_question_mock.return_value = "Improved question text"

        for _ in range(10):
            response = self.client.post(self.improve_url, {}, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        throttled_response = self.client.post(self.improve_url, {}, format="json")

        self.assertEqual(throttled_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(improve_question_mock.call_count, 10)
