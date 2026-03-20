import json

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from surveys.models import AIChatMessage, AIChatSession, Question
from surveys.services.ai_insights import QuestionAnalyticsInsightsService
from surveys.services.ai_service import AIService, AIServiceRequestError
from surveys.services.analytics import AnalyticsService
from surveys.services.filters import ResponseFilterService


STRUCTURAL_TYPES = {
    Question.QuestionType.SECTION_HEADING,
    Question.QuestionType.INSTRUCTIONAL_TEXT,
}


class AIChatService(QuestionAnalyticsInsightsService):
    SUMMARY_CACHE_TIMEOUT_SECONDS = 10 * 60
    SUMMARY_CONTEXT_CHAR_LIMIT = 12000
    CHAT_CONTEXT_CHAR_LIMIT = 18000
    MAX_CHAT_HISTORY_MESSAGES = 20
    MAX_VERBATIMS = 12
    MAX_OUTPUT_TOKENS_SUMMARY = 1400
    MAX_OUTPUT_TOKENS_CHAT = 700

    def __init__(self, survey, user, *, raw_filters=None):
        super().__init__()
        self.survey = survey
        self.user = user
        self.raw_filters = raw_filters or {}
        self.analytics_service = AnalyticsService(
            survey,
            raw_filters=self.raw_filters,
            include_insights=False,
        )

    def create_session(self):
        return AIChatSession.objects.create(
            survey=self.survey,
            user=self.user,
            title="New chat",
        )

    def build_summary(self):
        provider_config = self.ai_service.get_provider_config()
        summary = self.analytics_service.get_summary()
        if not summary.get("total_responses"):
            raise AIServiceRequestError("No responses are available for AI insights yet.")

        cache_key = self._build_summary_cache_key(
            provider=provider_config.provider,
            model=provider_config.model,
        )
        cached = self._cache_get(cache_key)
        if cached:
            return cached

        context_payload = self._build_survey_context(
            char_limit=self.SUMMARY_CONTEXT_CHAR_LIMIT,
        )
        summary_text = self.ai_service.call(
            self._summary_system_prompt(),
            context_payload,
            max_output_tokens=self.MAX_OUTPUT_TOKENS_SUMMARY,
            reasoning_effort="none",
            verbosity="low",
        )
        parsed = self._parse_summary_text(summary_text)

        result = {
            "headline": self._normalize_line(parsed.get("headline", "")),
            "summary": self._normalize_text(parsed.get("summary", ""))[:700],
            "key_findings": [
                self._normalize_text(item)[:260]
                for item in (parsed.get("key_findings") or [])
                if self._normalize_text(item)
            ][:4],
            "recommendations": [
                self._normalize_text(item)[:260]
                for item in (parsed.get("recommendations") or [])
                if self._normalize_text(item)
            ][:3],
            "suggested_questions": [
                self._normalize_text(item)[:180]
                for item in (parsed.get("suggested_questions") or [])
                if self._normalize_text(item)
            ][:3],
            "provider": provider_config.provider,
            "response_scope": self._build_response_scope(summary),
        }
        self._cache_set(cache_key, result, timeout=self.SUMMARY_CACHE_TIMEOUT_SECONDS)
        return result

    def chat(self, session, message):
        normalized_message = self._normalize_text(message)[:4000]
        if not normalized_message:
            raise AIServiceRequestError("Enter a message before sending.")

        summary = self.analytics_service.get_summary()
        if not summary.get("total_responses"):
            raise AIServiceRequestError("No responses are available for AI insights yet.")

        context_payload = self._build_survey_context(
            char_limit=self.CHAT_CONTEXT_CHAR_LIMIT,
        )
        history = list(
            session.messages.order_by("-created_at")[: self.MAX_CHAT_HISTORY_MESSAGES]
        )
        history.reverse()
        recent_messages = [
            {
                "role": item.role,
                "content": item.content,
                "scope": item.context_meta.get("scope_label", ""),
            }
            for item in history
        ]
        scope_meta = self._build_scope_meta(summary)

        assistant_response = self.ai_service.call(
            self._chat_system_prompt(),
            {
                "response_scope": scope_meta,
                "survey_context": context_payload,
                "recent_messages": recent_messages,
                "user_message": normalized_message,
            },
            max_output_tokens=self.MAX_OUTPUT_TOKENS_CHAT,
        )
        normalized_response = self._normalize_chat_response(assistant_response)
        if not normalized_response:
            raise AIServiceRequestError("The AI provider returned an empty response.")

        with transaction.atomic():
            user_message = AIChatMessage.objects.create(
                session=session,
                role=AIChatMessage.Role.USER,
                content=normalized_message,
                context_meta=scope_meta,
            )
            assistant_message = AIChatMessage.objects.create(
                session=session,
                role=AIChatMessage.Role.ASSISTANT,
                content=normalized_response,
                context_meta={
                    **scope_meta,
                    "provider": self.ai_service.provider,
                },
            )

            if session.title == "New chat" and not history:
                session.title = self._build_session_title(normalized_message)
            session.updated_at = timezone.now()
            session.save(update_fields=["title", "updated_at"])

        return user_message, assistant_message

    def _build_summary_cache_key(self, *, provider, model):
        summary = self.analytics_service.get_summary()
        responses = self.analytics_service.get_filtered_responses()
        latest_answered_at = max(
            (
                answer.answered_at.isoformat()
                for answer in self._iter_answers_for_responses(responses)
                if answer.answered_at
            ),
            default="none",
        )
        return (
            "survey-ai-summary:"
            f"{self.survey.id}:{provider}:{model}:"
            f"{self._signature(self.raw_filters)}:{summary.get('total_responses', 0)}:{latest_answered_at}:"
            f"{self.survey.updated_at.isoformat()}"
        )

    def _build_survey_context(self, *, char_limit):
        summary = self.analytics_service.get_summary()
        question_analytics = self.analytics_service.get_all_question_analytics()
        question_number_lookup = self._build_question_number_lookup()
        ordered_analytics = sorted(
            question_analytics,
            key=lambda item: question_number_lookup.get(item["question"]["id"], 10**6),
        )

        compact_questions = [
            self._compact_question_analytics(
                analytics,
                question_number=question_number_lookup.get(analytics["question"]["id"]),
            )
            for analytics in ordered_analytics
        ]
        masked_verbatims = self._build_masked_verbatims(
            ordered_analytics,
            question_number_lookup,
        )

        payload = {
            "survey": {
                "title": self._normalize_line(self.survey.title),
                "description": self._normalize_text(self.survey.description),
            },
            "response_scope": self._build_response_scope(summary),
            "questions": compact_questions,
            "masked_verbatims": [],
        }

        for item in masked_verbatims:
            candidate = {
                **payload,
                "masked_verbatims": [*payload["masked_verbatims"], item],
            }
            if len(json.dumps(candidate, ensure_ascii=True, default=str)) > char_limit:
                break
            payload["masked_verbatims"].append(item)

        return payload

    def _compact_question_analytics(self, analytics, *, question_number=None):
        question = analytics.get("question", {})
        compact = self._compact_analytics_payload(analytics)
        compact = self._prune_summary_analytics(compact)
        compact["question"] = {
            "id": question.get("id"),
            "number": question_number,
            "text": self._normalize_line(question.get("text", "")),
            "description": self._normalize_text(question.get("description", "")),
            "type": question.get("type"),
        }
        return compact

    def _prune_summary_analytics(self, compact):
        analytics_type = compact.get("type")

        if analytics_type == "categorical":
            choices = compact.get("choices") or []
            non_zero_choices = [item for item in choices if (item.get("count") or 0) > 0]
            selected_choices = non_zero_choices[:8] or choices[:5]
            compact["choices"] = selected_choices
            hidden_choice_count = max(len(choices) - len(selected_choices), 0)
            if hidden_choice_count:
                compact["hidden_choice_count"] = hidden_choice_count

        elif analytics_type == "text":
            compact["word_frequencies"] = (compact.get("word_frequencies") or [])[:10]

        elif analytics_type == "constant_sum":
            compact["items"] = (compact.get("items") or [])[:6]

        elif analytics_type == "ranking":
            compact["items"] = (compact.get("items") or [])[:6]

        elif analytics_type == "matrix":
            compact["rows"] = (compact.get("rows") or [])[:6]

        elif analytics_type == "demographics":
            compact["fields"] = {
                field_name: (items or [])[:3]
                for field_name, items in list((compact.get("fields") or {}).items())[:5]
            }

        return compact

    def _build_masked_verbatims(self, analytics_list, question_number_lookup):
        verbatims = []

        for analytics in analytics_list:
            question = analytics.get("question", {})
            question_number = question_number_lookup.get(question.get("id"))
            question_label = f"Q{question_number}" if question_number else question.get("text", "Question")

            if analytics.get("type") == "text":
                for response in (analytics.get("responses") or [])[:4]:
                    text = self._mask_text(response.get("text"))
                    if text:
                        verbatims.append(
                            {
                                "question": question_label,
                                "kind": "verbatim",
                                "text": text,
                            }
                        )

            if analytics.get("type") == "open_ended":
                for field in analytics.get("fields", []) or []:
                    for response in (field.get("responses") or [])[:3]:
                        text = self._mask_text(response)
                        if text:
                            verbatims.append(
                                {
                                    "question": question_label,
                                    "kind": f"open_ended:{field.get('field_label') or field.get('field_name')}",
                                    "text": text,
                                }
                            )

            if analytics.get("type") == "categorical":
                for response in (analytics.get("comments") or [])[:3]:
                    text = self._mask_text(response)
                    if text:
                        verbatims.append(
                            {
                                "question": question_label,
                                "kind": "comment",
                                "text": text,
                            }
                        )
                for response in (analytics.get("other_responses") or [])[:3]:
                    text = self._mask_text(response)
                    if text:
                        verbatims.append(
                            {
                                "question": question_label,
                                "kind": "other_response",
                                "text": text,
                            }
                        )

            if len(verbatims) >= self.MAX_VERBATIMS:
                break

        return verbatims[: self.MAX_VERBATIMS]

    def _build_question_number_lookup(self):
        lookup = {}
        next_number = 1
        pages = self.survey.pages.prefetch_related("questions").order_by("order")

        for page in pages:
            for question in page.questions.all():
                if question.question_type in STRUCTURAL_TYPES:
                    continue
                lookup[str(question.id)] = next_number
                next_number += 1

        return lookup

    def _build_scope_meta(self, summary):
        response_scope = self._build_response_scope(summary)
        return {
            "filters": self.raw_filters or {},
            "filters_active": response_scope["filters_active"],
            "scope_label": response_scope["label"],
            "total_responses": response_scope["total_responses"],
            "completion_rate": response_scope["completion_rate"],
        }

    def _build_response_scope(self, summary):
        total_responses = int(summary.get("total_responses") or 0)
        completion_rate = float(summary.get("completion_rate") or 0)
        filters_active = self._has_active_filters(self.raw_filters)
        label = (
            f"Filtered dataset · {total_responses} responses"
            if filters_active
            else f"All responses · {total_responses} responses"
        )
        return {
            "label": label,
            "total_responses": total_responses,
            "completion_rate": completion_rate,
            "filters_active": filters_active,
        }

    def _has_active_filters(self, raw_filters):
        parsed = ResponseFilterService.parse_filters(raw_filters or {})
        return bool(
            parsed.date_from
            or parsed.date_to
            or parsed.collector_id
            or parsed.status
            or parsed.answer_filters
            or parsed.duration_min_seconds is not None
            or parsed.duration_max_seconds is not None
            or parsed.text_search
        )

    def _iter_answers_for_responses(self, responses):
        return self.analytics_service._get_question_answers_queryset_for_responses(responses)

    def _build_session_title(self, message):
        line = self._normalize_text(message).split("?")[0].strip() or "New chat"
        return line[:80]

    def _normalize_chat_response(self, value):
        normalized = (value or "").strip()
        if not normalized:
            return ""
        return normalized[:6000]

    def _summary_system_prompt(self):
        return (
            "You are a senior survey insights strategist. Produce a high-signal executive "
            "summary of the current filtered survey results. Synthesize cross-question "
            "patterns, tensions, risks, and opportunities. Do not repeat obvious chart data "
            "mechanically. Use exact counts and percentages when they sharpen the point. "
            "Be specific, concise, and decision-ready. Return plain text only using exactly this format and no other wrapper text:\n"
            "HEADLINE: <one sentence>\n"
            "SUMMARY: <two to four sentences>\n"
            "KEY FINDINGS:\n"
            "- <finding one>\n"
            "- <finding two>\n"
            "- <finding three if needed>\n"
            "RECOMMENDATIONS:\n"
            "- <recommendation one>\n"
            "- <recommendation two>\n"
            "SUGGESTED QUESTIONS:\n"
            "- <question one>\n"
            "- <question two>\n"
            "- <question three>\n"
            "Do not use JSON. Do not use markdown fences."
        )

    def _chat_system_prompt(self):
        return (
            "You are Questiz AI, an analytics copilot for survey results. Answer only from "
            "the provided filtered dataset and conversation history. Be concise, factual, and "
            "numerically specific. Reference question numbers and exact counts or percentages "
            "when relevant. If evidence is weak or incomplete, say so clearly. Return safe "
            "markdown only. Do not output raw HTML."
        )

    def _parse_summary_text(self, value):
        normalized = self._normalize_text_block(value)
        headline = self._extract_labeled_value(normalized, "HEADLINE")
        summary = self._extract_labeled_value(normalized, "SUMMARY")
        key_findings = self._extract_labeled_list(normalized, "KEY FINDINGS")
        recommendations = self._extract_labeled_list(normalized, "RECOMMENDATIONS")
        suggested_questions = self._extract_labeled_list(
            normalized,
            "SUGGESTED QUESTIONS",
        )

        if not headline or not summary or len(key_findings) < 2 or len(recommendations) < 2:
            raise AIServiceRequestError("The AI provider returned an invalid insights format.")

        if len(suggested_questions) < 3:
            raise AIServiceRequestError("The AI provider returned an invalid insights format.")

        return {
            "headline": headline,
            "summary": summary,
            "key_findings": key_findings[:4],
            "recommendations": recommendations[:3],
            "suggested_questions": suggested_questions[:3],
        }

    def _extract_labeled_list(self, value, label):
        block = self._extract_labeled_block(value, label)
        if not block:
            return []

        items = []
        for line in block.splitlines():
            cleaned = line.strip()
            if not cleaned:
                continue
            if cleaned.startswith("-"):
                cleaned = cleaned[1:].strip()
            cleaned = self._normalize_text(cleaned)
            if cleaned:
                items.append(cleaned)
        return items

    def _cache_set(self, cache_key, value, *, timeout=None):
        try:
            cache.set(cache_key, value, timeout or self.CACHE_TIMEOUT_SECONDS)
        except Exception:
            return None
        return value
