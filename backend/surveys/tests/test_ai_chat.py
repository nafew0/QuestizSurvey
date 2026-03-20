from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import SiteSettings
from surveys.models import (
    AIChatMessage,
    AIChatSession,
    Answer,
    Choice,
    Collector,
    Page,
    Question,
    Survey,
    SurveyResponse,
)
from surveys.services.ai_service import (
    AIProviderConfig,
    AIServiceConfigurationError,
    AIServiceRequestError,
)

User = get_user_model()


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "ai-chat-tests",
        }
    }
)
class AIChatApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="chat-owner",
            email="chat-owner@example.com",
            password="TestPass123!",
        )
        self.other_user = User.objects.create_user(
            username="chat-outsider",
            email="chat-outsider@example.com",
            password="TestPass123!",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.survey = Survey.objects.create(
            user=self.user,
            title="Campus connectivity pulse",
            description="Survey about reliability, support, and network capacity.",
            status=Survey.Status.ACTIVE,
        )
        self.page = Page.objects.create(survey=self.survey, title="Page 1", order=1)
        self.web_collector = Collector.objects.create(
            survey=self.survey,
            type=Collector.CollectorType.WEB_LINK,
            name="Web",
            status=Collector.Status.OPEN,
        )
        self.email_collector = Collector.objects.create(
            survey=self.survey,
            type=Collector.CollectorType.EMAIL,
            name="Email",
            status=Collector.Status.OPEN,
        )

        self.choice_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
            text="How would you rate the network this quarter?",
            order=1,
        )
        self.choice_great = Choice.objects.create(
            question=self.choice_question,
            text="Great",
            order=1,
        )
        self.choice_okay = Choice.objects.create(
            question=self.choice_question,
            text="Okay",
            order=2,
        )

        self.text_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.LONG_TEXT,
            text="What stands out most about your experience?",
            order=2,
        )
        self.file_question = Question.objects.create(
            page=self.page,
            question_type=Question.QuestionType.FILE_UPLOAD,
            text="Upload supporting evidence",
            order=3,
        )

        base_time = timezone.now() - timedelta(days=2)
        self._create_response(
            collector=self.web_collector,
            respondent_email="web-one@example.com",
            started_at=base_time,
            completed_at=base_time + timedelta(minutes=4),
            choice_id=self.choice_great.id,
            comment_text="Reach me at owner@example.com or +8801712345678. Visit https://questiz.test.",
            other_text="The outage ID is 123e4567-e89b-12d3-a456-426614174000",
            text_value="Students repeatedly mention faster onboarding and more confidence in support.",
            file_url="https://cdn.example.com/private/network-report.pdf?token=abc123",
        )
        self._create_response(
            collector=self.email_collector,
            respondent_email="email-one@example.com",
            started_at=base_time + timedelta(days=1),
            completed_at=base_time + timedelta(days=1, minutes=5),
            choice_id=self.choice_okay.id,
            comment_text="Support is polite but resolution takes too long.",
            other_text="Need better escalation ownership.",
            text_value="Several operators describe the service as stable but not memorable.",
            file_url="https://cdn.example.com/private/evidence.png?signature=xyz987",
        )

        SiteSettings.objects.update_or_create(
            id=1,
            defaults={
                "ai_provider": SiteSettings.AIProvider.OPENAI,
                "ai_model_openai": "gpt-5-mini",
                "ai_api_key_openai": "test-key",
            },
        )

    def _create_response(
        self,
        *,
        collector,
        respondent_email,
        started_at,
        completed_at,
        choice_id,
        comment_text,
        other_text,
        text_value,
        file_url,
    ):
        response = SurveyResponse.objects.create(
            survey=self.survey,
            collector=collector,
            respondent_email=respondent_email,
            status=SurveyResponse.Status.COMPLETED,
            current_page=self.page,
        )
        SurveyResponse.objects.filter(id=response.id).update(
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=240,
        )
        response.refresh_from_db()

        Answer.objects.create(
            response=response,
            question=self.choice_question,
            choice_ids=[str(choice_id)],
            comment_text=comment_text,
            other_text=other_text,
        )
        Answer.objects.create(
            response=response,
            question=self.text_question,
            text_value=text_value,
        )
        Answer.objects.create(
            response=response,
            question=self.file_question,
            file_url=file_url,
        )
        return response

    @patch(
        "surveys.services.ai_chat_service.AIService.get_provider_config",
        return_value=AIProviderConfig("openai", "gpt-5-mini", "test-key"),
    )
    @patch(
        "surveys.services.ai_chat_service.AIService.call",
        return_value=(
            "HEADLINE: Network confidence is strong, but delight is uneven.\n"
            "SUMMARY: Support quality props up the headline score, but the filtered comments reveal slower resolution as the recurring drag.\n"
            "KEY FINDINGS:\n"
            "- Promoters anchor their praise in reliability and support.\n"
            "- Neutral responses still surface a friction pattern around time-to-resolution.\n"
            "RECOMMENDATIONS:\n"
            "- Tighten escalation handling for the neutral segment.\n"
            "- Turn the strongest support language into proof points.\n"
            "SUGGESTED QUESTIONS:\n"
            "- Which respondent segment is most at risk of slipping next quarter?\n"
            "- What themes show up most often in qualitative feedback?\n"
            "- Which question has the sharpest contradiction in the results?"
        ),
    )
    def test_summary_endpoint_uses_cache_and_returns_payload(
        self,
        mocked_call,
        _mocked_provider_config,
    ):
        url = f"/api/surveys/{self.survey.id}/ai/insights/"

        first = self.client.post(url, {"filters": {"status": "completed"}}, format="json")
        second = self.client.post(url, {"filters": {"status": "completed"}}, format="json")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["headline"], "Network confidence is strong, but delight is uneven.")
        self.assertEqual(first.data["provider"], "openai")
        self.assertEqual(first.data["response_scope"]["total_responses"], 2)
        self.assertEqual(mocked_call.call_count, 1)

    @patch(
        "surveys.services.ai_chat_service.AIService.get_provider_config",
        return_value=AIProviderConfig("openai", "gpt-5-mini", "test-key"),
    )
    @patch(
        "surveys.services.ai_chat_service.AIService.call",
        return_value=(
            "HEADLINE: Filtered segment summary.\n"
            "SUMMARY: One collector shows the sharper friction pattern.\n"
            "KEY FINDINGS:\n"
            "- One\n"
            "- Two\n"
            "RECOMMENDATIONS:\n"
            "- Do A\n"
            "- Do B\n"
            "SUGGESTED QUESTIONS:\n"
            "- Q1\n"
            "- Q2\n"
            "- Q3"
        ),
    )
    def test_summary_endpoint_honors_filters(
        self,
        mocked_call,
        _mocked_provider_config,
    ):
        response = self.client.post(
            f"/api/surveys/{self.survey.id}/ai/insights/",
            {"filters": {"collector_id": str(self.email_collector.id)}},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user_prompt = mocked_call.call_args.args[1]
        self.assertEqual(user_prompt["response_scope"]["total_responses"], 1)
        self.assertEqual(len(user_prompt["questions"]), 3)

    def test_non_owner_cannot_access_summary_or_chat_endpoints(self):
        outsider_client = APIClient()
        outsider_client.force_authenticate(self.other_user)

        summary_response = outsider_client.post(
            f"/api/surveys/{self.survey.id}/ai/insights/",
            {},
            format="json",
        )
        sessions_response = outsider_client.get(f"/api/surveys/{self.survey.id}/ai/chats/")

        self.assertEqual(summary_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(sessions_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_list_detail_and_delete_chat_sessions(self):
        create_response = self.client.post(f"/api/surveys/{self.survey.id}/ai/chats/", {}, format="json")

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        session_id = create_response.data["id"]

        list_response = self.client.get(f"/api/surveys/{self.survey.id}/ai/chats/")
        detail_response = self.client.get(f"/api/surveys/{self.survey.id}/ai/chats/{session_id}/")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["messages"], [])

        AIChatMessage.objects.create(
            session=AIChatSession.objects.get(id=session_id),
            role=AIChatMessage.Role.USER,
            content="Temporary message",
        )

        delete_response = self.client.delete(f"/api/surveys/{self.survey.id}/ai/chats/{session_id}/")

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AIChatSession.objects.filter(id=session_id).exists())
        self.assertEqual(AIChatMessage.objects.count(), 0)

    @patch(
        "surveys.services.ai_chat_service.AIService.get_provider_config",
        return_value=AIProviderConfig("openai", "gpt-5-mini", "test-key"),
    )
    @patch(
        "surveys.services.ai_chat_service.AIService.call",
        return_value=(
            "Short answer first.\n\n"
            "- Reliability is the strongest positive signal.\n"
            "- Slow resolution is the clearest drag in the comments."
        ),
    )
    def test_send_message_persists_chat_turns_and_sets_title(
        self,
        mocked_call,
        _mocked_provider_config,
    ):
        session = AIChatSession.objects.create(survey=self.survey, user=self.user)

        response = self.client.post(
            f"/api/surveys/{self.survey.id}/ai/chats/{session.id}/messages/",
            {
                "message": "Where is the biggest risk in these results?",
                "filters": {"collector_id": str(self.web_collector.id)},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["role"], AIChatMessage.Role.ASSISTANT)
        self.assertIn("Short answer first.", response.data["content"])

        session.refresh_from_db()
        self.assertEqual(session.title, "Where is the biggest risk in these results")

        messages = list(session.messages.order_by("created_at"))
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0].role, AIChatMessage.Role.USER)
        self.assertTrue(messages[0].context_meta["filters_active"])
        self.assertEqual(messages[0].context_meta["total_responses"], 1)
        self.assertEqual(messages[1].role, AIChatMessage.Role.ASSISTANT)
        self.assertEqual(messages[1].context_meta["provider"], "openai")

        user_prompt = mocked_call.call_args.args[1]
        self.assertEqual(user_prompt["response_scope"]["total_responses"], 1)
        self.assertEqual(user_prompt["user_message"], "Where is the biggest risk in these results?")

    @patch(
        "surveys.services.ai_chat_service.AIService.get_provider_config",
        return_value=AIProviderConfig("openai", "gpt-5-mini", "test-key"),
    )
    @patch(
        "surveys.services.ai_chat_service.AIService.call",
        return_value="Chat response.",
    )
    def test_chat_masks_pii_and_omits_file_urls(
        self,
        mocked_call,
        _mocked_provider_config,
    ):
        session = AIChatSession.objects.create(survey=self.survey, user=self.user)

        response = self.client.post(
            f"/api/surveys/{self.survey.id}/ai/chats/{session.id}/messages/",
            {"message": "Summarize the themes in the comments."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user_prompt = mocked_call.call_args.args[1]
        masked_verbatims = user_prompt["survey_context"]["masked_verbatims"]

        masked_texts = [item["text"] for item in masked_verbatims]
        self.assertTrue(any("[email]" in item for item in masked_texts))
        self.assertTrue(any("[phone]" in item for item in masked_texts))
        self.assertTrue(any("[url]" in item for item in masked_texts))
        self.assertTrue(any("[id]" in item for item in masked_texts))
        self.assertFalse(
            any("cdn.example.com" in item or "token=" in item for item in masked_texts)
        )

    @patch(
        "surveys.services.ai_chat_service.AIService.get_provider_config",
        return_value=AIProviderConfig("openai", "gpt-5-mini", "test-key"),
    )
    @patch(
        "surveys.services.ai_chat_service.AIService.call",
        return_value="Chat response.",
    )
    def test_chat_message_throttle_blocks_after_limit(
        self,
        _mocked_call,
        _mocked_provider_config,
    ):
        session = AIChatSession.objects.create(survey=self.survey, user=self.user)
        url = f"/api/surveys/{self.survey.id}/ai/chats/{session.id}/messages/"
        last_response = None

        for index in range(11):
            last_response = self.client.post(
                url,
                {"message": f"Prompt {index}", "filters": {"attempt": index}},
                format="json",
            )

        self.assertIsNotNone(last_response)
        self.assertEqual(last_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @patch(
        "surveys.services.ai_chat_service.AIService.get_provider_config",
        side_effect=AIServiceConfigurationError("OpenAI API key is not configured."),
    )
    def test_summary_returns_503_when_provider_configuration_is_missing(self, _mocked_provider):
        response = self.client.post(
            f"/api/surveys/{self.survey.id}/ai/insights/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch(
        "surveys.services.ai_chat_service.AIService.get_provider_config",
        return_value=AIProviderConfig("openai", "gpt-5-mini", "test-key"),
    )
    @patch(
        "surveys.services.ai_chat_service.AIService.call",
        side_effect=AIServiceRequestError("The AI provider timed out."),
    )
    def test_chat_message_returns_502_for_provider_errors(
        self,
        _mocked_call,
        _mocked_provider_config,
    ):
        session = AIChatSession.objects.create(survey=self.survey, user=self.user)

        response = self.client.post(
            f"/api/surveys/{self.survey.id}/ai/chats/{session.id}/messages/",
            {"message": "What is the biggest risk?"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
