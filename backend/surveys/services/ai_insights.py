import hashlib
import json
import os
import re
from urllib.parse import urlparse

from django.core.cache import cache

from surveys.answer_formatting import OPEN_ENDED_OTHER_KEY
from surveys.models import Question
from surveys.services.ai_service import (
    AIService,
    AIServiceConfigurationError,
    AIServiceRequestError,
)


class AnalyticsTextInsightsService:
    """Optional ChatGPT-powered narrative insights for analytics payloads."""

    def __init__(self):
        self.ai_service = AIService()

    @property
    def enabled(self):
        return self.ai_service.enabled

    def build_insights(self, survey_title, insight_type, analytics_payload):
        if not self.enabled:
            return {
                "available": False,
                "source": self.ai_service.provider or "ai",
                "reason": "AI provider is not configured.",
                "headline": "",
                "bullets": [],
            }

        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "headline": {"type": "string"},
                "bullets": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 2,
                    "maxItems": 5,
                },
            },
            "required": ["headline", "bullets"],
        }

        try:
            parsed = self.ai_service.call(
                (
                    "You are an analytics assistant for survey data. "
                    "Return concise, factual, non-speculative insights in JSON."
                ),
                {
                    "survey_title": survey_title,
                    "insight_type": insight_type,
                    "analytics_payload": analytics_payload,
                },
                response_schema=schema,
                max_output_tokens=260,
            )
        except (AIServiceConfigurationError, AIServiceRequestError) as exc:
            return {
                "available": False,
                "source": self.ai_service.provider or "ai",
                "reason": str(exc),
                "headline": "",
                "bullets": [],
            }

        return {
            "available": True,
            "source": self.ai_service.provider,
            "headline": parsed.get("headline", ""),
            "bullets": parsed.get("bullets", []),
        }


class QuestionAnalyticsInsightsService:
    CACHE_TIMEOUT_SECONDS = 15 * 60
    MAX_PROMPT_CONTEXT_CHARS = 18000
    MAX_OUTPUT_TOKENS = 520

    EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
    URL_PATTERN = re.compile(r"\b(?:https?://|www\.)\S+\b", re.IGNORECASE)
    PHONE_PATTERN = re.compile(
        r"(?:(?<=\s)|^)(?:\+?\d[\d()\-\s]{7,}\d)(?=(?:\s|$|[.,]))"
    )
    IPV4_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
    UUID_PATTERN = re.compile(
        r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
        re.IGNORECASE,
    )
    LONG_TOKEN_PATTERN = re.compile(r"\b[A-Za-z0-9_-]{24,}\b")

    def __init__(self):
        self.ai_service = AIService()

    def build_insights(
        self,
        *,
        survey,
        question,
        analytics_payload,
        answers,
        raw_filters=None,
    ):
        provider_config = self.ai_service.get_provider_config()
        serialized_answers = [
            serialized
            for serialized in (self._serialize_answer(question, answer) for answer in answers)
            if serialized
        ]
        if not serialized_answers:
            raise AIServiceRequestError("No usable responses are available for AI insights.")

        cache_key = self._build_cache_key(
            survey=survey,
            question=question,
            provider=provider_config.provider,
            model=provider_config.model,
            raw_filters=raw_filters or {},
            answers=answers,
        )
        cached = self._cache_get(cache_key)
        if cached:
            return cached

        context_payload, responses_included = self._build_context_payload(
            survey=survey,
            question=question,
            analytics_payload=analytics_payload,
            serialized_answers=serialized_answers,
        )
        parsed = self.ai_service.call(
            self._system_prompt(),
            context_payload,
            response_schema=self._response_schema(),
            max_output_tokens=self.MAX_OUTPUT_TOKENS,
        )

        result = {
            "available": True,
            "provider": provider_config.provider,
            "takeaway": self._normalize_line(parsed.get("takeaway", "")),
            "insights": [
                self._normalize_line(item)
                for item in (parsed.get("insights") or [])
                if self._normalize_line(item)
            ][:3],
            "recommended_action": self._normalize_line(
                parsed.get("recommended_action", "")
            ),
            "responses_total": len(serialized_answers),
            "responses_included": responses_included,
            "truncated": responses_included < len(serialized_answers),
        }
        self._cache_set(cache_key, result)
        return result

    def _cache_get(self, cache_key):
        try:
            return cache.get(cache_key)
        except Exception:
            return None

    def _cache_set(self, cache_key, value):
        try:
            cache.set(cache_key, value, self.CACHE_TIMEOUT_SECONDS)
        except Exception:
            return None
        return value

    def _build_cache_key(
        self,
        *,
        survey,
        question,
        provider,
        model,
        raw_filters,
        answers,
    ):
        question_signature = self._signature(
            {
                "question_type": question.question_type,
                "text": question.text,
                "description": question.description,
                "settings": question.settings,
                "choices": [
                    {
                        "id": str(choice.id),
                        "text": choice.text,
                        "is_other": choice.is_other,
                        "order": choice.order,
                    }
                    for choice in question.choices.all()
                ],
            }
        )
        latest_answered_at = max(
            (answer.answered_at.isoformat() for answer in answers if answer.answered_at),
            default="none",
        )
        filters_signature = self._signature(raw_filters or {})

        return (
            "question-ai-insight:"
            f"{survey.id}:{question.id}:{provider}:{model}:{filters_signature}:"
            f"{question_signature}:{len(answers)}:{latest_answered_at}"
        )

    def _build_context_payload(
        self,
        *,
        survey,
        question,
        analytics_payload,
        serialized_answers,
    ):
        base_payload = {
            "survey": {
                "title": self._normalize_line(survey.title),
                "description": self._normalize_text(survey.description),
            },
            "question": self._build_question_context(question),
            "analytics": self._compact_analytics_payload(analytics_payload),
            "raw_responses": [],
        }

        included_responses = []
        for response in serialized_answers:
            candidate = [*included_responses, response]
            candidate_payload = {
                **base_payload,
                "raw_responses": candidate,
            }
            if len(json.dumps(candidate_payload, ensure_ascii=True)) > self.MAX_PROMPT_CONTEXT_CHARS:
                break
            included_responses = candidate

        base_payload["raw_responses"] = included_responses
        return base_payload, len(included_responses)

    def _compact_analytics_payload(self, analytics_payload):
        payload = json.loads(json.dumps(analytics_payload))

        payload.pop("insights", None)
        if payload.get("type") == "categorical":
            payload["other_response_count"] = len(payload.pop("other_responses", []) or [])
            payload["comment_count"] = len(payload.pop("comments", []) or [])
        elif payload.get("type") == "text":
            payload.pop("responses", None)
            payload["word_frequencies"] = (payload.get("word_frequencies") or [])[:25]
        elif payload.get("type") == "open_ended":
            for field in payload.get("fields", []) or []:
                field["response_count"] = len(field.pop("responses", []) or [])
                field["items"] = (field.get("items") or [])[:12]
        elif payload.get("type") == "files":
            files = payload.pop("files", []) or []
            file_type_counts = {}
            for item in files:
                file_type = item.get("file_type") or "unknown"
                file_type_counts[file_type] = file_type_counts.get(file_type, 0) + 1
            payload["file_type_counts"] = file_type_counts

        return payload

    def _build_question_context(self, question):
        context = {
            "title": self._normalize_line(question.text),
            "description": self._normalize_text(question.description),
            "question_type": question.get_question_type_display(),
        }

        if question.choices.exists():
            context["options"] = [self._normalize_line(choice.text) for choice in question.choices.all()]

        rows = question.settings.get("rows")
        columns = question.settings.get("columns")
        dropdown_options = question.settings.get("dropdown_options")
        scale = {
            key: question.settings.get(key)
            for key in ["min_value", "max_value", "left_label", "right_label", "mode"]
            if question.settings.get(key) not in (None, "")
        }

        if rows:
            context["rows"] = [self._normalize_line(value) for value in rows]
        if columns:
            context["columns"] = [self._normalize_line(value) for value in columns]
        if dropdown_options:
            context["dropdown_options"] = [
                self._normalize_line(value) for value in dropdown_options
            ]
        if scale:
            context["settings"] = scale

        return context

    def _serialize_answer(self, question, answer):
        choice_map = {str(choice.id): choice.text for choice in question.choices.all()}
        question_type = question.question_type

        if question_type in {
            Question.QuestionType.MULTIPLE_CHOICE_SINGLE,
            Question.QuestionType.MULTIPLE_CHOICE_MULTI,
            Question.QuestionType.DROPDOWN,
            Question.QuestionType.YES_NO,
            Question.QuestionType.IMAGE_CHOICE,
        }:
            payload = {
                "selected_options": [
                    self._normalize_line(choice_map.get(str(choice_id), str(choice_id)))
                    for choice_id in (answer.choice_ids or [])
                ]
            }
            self._append_masked_text(payload, "other_text", answer.other_text)
            self._append_masked_text(payload, "comment", answer.comment_text)
            return payload if any(payload.values()) else None

        if question_type in {
            Question.QuestionType.SHORT_TEXT,
            Question.QuestionType.LONG_TEXT,
        }:
            text_value = self._mask_text(answer.text_value)
            return {"text": text_value} if text_value else None

        if question_type in {
            Question.QuestionType.RATING_SCALE,
            Question.QuestionType.STAR_RATING,
            Question.QuestionType.NPS,
        }:
            if answer.numeric_value is None:
                return None
            return {"value": float(answer.numeric_value)}

        if question_type == Question.QuestionType.DATE_TIME:
            if answer.date_value:
                return {"value": answer.date_value.isoformat()}
            text_value = self._mask_text(answer.text_value)
            return {"value": text_value} if text_value else None

        if question_type == Question.QuestionType.OPEN_ENDED:
            matrix_data = {}
            for field_name, raw_value in (answer.matrix_data or {}).items():
                label = "Other" if field_name == OPEN_ENDED_OTHER_KEY else str(field_name)
                masked = self._mask_text(raw_value)
                if masked:
                    matrix_data[label] = masked
            return {"responses": matrix_data} if matrix_data else None

        if question_type == Question.QuestionType.MATRIX:
            rows = {}
            for row_label, raw_value in (answer.matrix_data or {}).items():
                if isinstance(raw_value, dict):
                    selected_columns = [
                        self._normalize_line(column_label)
                        for column_label, is_selected in raw_value.items()
                        if is_selected
                    ]
                    if selected_columns:
                        rows[self._normalize_line(row_label)] = selected_columns
                else:
                    value = self._normalize_line(raw_value)
                    if value:
                        rows[self._normalize_line(row_label)] = value
            return {"matrix": rows} if rows else None

        if question_type == Question.QuestionType.MATRIX_PLUS:
            rows = {}
            for row_label, row_values in (answer.matrix_data or {}).items():
                if not isinstance(row_values, dict):
                    continue
                columns = {}
                for column_label, raw_value in row_values.items():
                    value = self._mask_text(raw_value)
                    if value:
                        columns[self._normalize_line(column_label)] = value
                if columns:
                    rows[self._normalize_line(row_label)] = columns
            return {"matrix": rows} if rows else None

        if question_type == Question.QuestionType.RANKING:
            ranking = [
                self._normalize_line(choice_map.get(str(choice_id), str(choice_id)))
                for choice_id in (answer.ranking_data or [])
            ]
            return {"ranking": ranking} if ranking else None

        if question_type == Question.QuestionType.CONSTANT_SUM:
            allocations = {}
            for choice_id, raw_value in (answer.constant_sum_data or {}).items():
                try:
                    numeric_value = float(raw_value)
                except (TypeError, ValueError):
                    continue
                allocations[
                    self._normalize_line(choice_map.get(str(choice_id), str(choice_id)))
                ] = numeric_value
            return {"allocations": allocations} if allocations else None

        if question_type == Question.QuestionType.DEMOGRAPHICS:
            fields = {}
            for field_name, raw_value in (answer.matrix_data or {}).items():
                value = self._mask_text(raw_value)
                if value:
                    fields[self._normalize_line(field_name)] = value
            return {"fields": fields} if fields else None

        if question_type == Question.QuestionType.FILE_UPLOAD:
            if not answer.file_url:
                return None
            path = urlparse(answer.file_url).path or answer.file_url
            extension = os.path.splitext(path)[1].lstrip(".").lower() or "unknown"
            return {
                "file_type": extension,
                "answered_at": answer.answered_at.isoformat() if answer.answered_at else None,
            }

        text_value = self._mask_text(answer.text_value)
        return {"value": text_value} if text_value else None

    def _append_masked_text(self, payload, field_name, value):
        masked = self._mask_text(value)
        if masked:
            payload[field_name] = masked

    def _mask_text(self, value):
        normalized = self._normalize_text(value)
        if not normalized:
            return ""

        masked = self.EMAIL_PATTERN.sub("[email]", normalized)
        masked = self.URL_PATTERN.sub("[url]", masked)
        masked = self.PHONE_PATTERN.sub("[phone]", masked)
        masked = self.IPV4_PATTERN.sub("[ip]", masked)
        masked = self.UUID_PATTERN.sub("[id]", masked)
        masked = self.LONG_TOKEN_PATTERN.sub("[token]", masked)
        return masked

    def _normalize_text(self, value):
        normalized = " ".join(f"{value or ''}".split())
        return normalized[:2000]

    def _normalize_line(self, value):
        return self._normalize_text(value)[:280]

    def _signature(self, value):
        serialized = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]

    def _system_prompt(self):
        return (
            "You are a senior survey research strategist writing decision-ready insights "
            "for stakeholders. Use the survey context, option labels, analytics summary, "
            "and masked raw responses to produce premium-quality insight that feels sharp, "
            "specific, and presentation-ready. Be concise and evidence-based. Surface "
            "non-obvious patterns, contrasts, contradictions, polarization, and standout "
            "respondent language when supported. Call out weak samples or uncertainty when "
            "relevant. Avoid generic filler, speculation, invented causes, or merely "
            "restating chart labels. Return JSON only."
        )

    def _response_schema(self):
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "takeaway": {"type": "string"},
                "insights": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 3,
                    "maxItems": 3,
                },
                "recommended_action": {"type": "string"},
            },
            "required": ["takeaway", "insights", "recommended_action"],
        }
