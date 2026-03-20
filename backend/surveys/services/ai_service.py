import json
import logging
import os
import re
from dataclasses import dataclass
from urllib import error, request

from accounts.models import SiteSettings


OPENAI_API_URL = "https://api.openai.com/v1/responses"
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_TIMEOUT_SECONDS = 30
MAX_PROMPT_TEXT_LENGTH = 10000
MAX_SURVEY_TITLE_LENGTH = 200
AI_DEBUG_ENV_VAR = "AI_DEBUG_LOGGING"


logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """Base AI service error."""


class AIServiceConfigurationError(AIServiceError):
    """Raised when provider configuration is incomplete."""


class AIServiceRequestError(AIServiceError):
    """Raised when the provider request fails or returns invalid data."""


@dataclass(frozen=True)
class AIProviderConfig:
    provider: str
    model: str
    api_key: str


class AIService:
    """Unified AI service for Question Improver and later AI features."""

    def __init__(self):
        self.settings, _ = SiteSettings.objects.get_or_create(pk=1)
        self.provider = (self.settings.ai_provider or "").strip().lower()

    @property
    def enabled(self):
        try:
            self.get_provider_config()
        except AIServiceConfigurationError:
            return False
        return True

    def get_provider_config(self):
        if self.provider == SiteSettings.AIProvider.OPENAI:
            api_key = (
                os.environ.get("OPENAI_API_KEY", "").strip()
                or self.settings.ai_api_key_openai.strip()
            )
            model = (
                self.settings.ai_model_openai.strip()
                or os.environ.get("OPENAI_RESPONSES_MODEL", "").strip()
            )
            if not api_key:
                raise AIServiceConfigurationError("OpenAI API key is not configured.")
            if not model:
                raise AIServiceConfigurationError("OpenAI model is not configured.")
            return AIProviderConfig("openai", model, api_key)

        if self.provider == SiteSettings.AIProvider.ANTHROPIC:
            api_key = (
                os.environ.get("ANTHROPIC_API_KEY", "").strip()
                or self.settings.ai_api_key_anthropic.strip()
            )
            model = (
                self.settings.ai_model_anthropic.strip()
                or os.environ.get("ANTHROPIC_MODEL", "").strip()
            )
            if not api_key:
                raise AIServiceConfigurationError("Anthropic API key is not configured.")
            if not model:
                raise AIServiceConfigurationError("Anthropic model is not configured.")
            return AIProviderConfig("anthropic", model, api_key)

        raise AIServiceConfigurationError("Unsupported AI provider.")

    def call(
        self,
        system_prompt,
        user_prompt,
        *,
        response_schema=None,
        max_output_tokens=2400,
        reasoning_effort="low",
        verbosity=None,
    ):
        config = self.get_provider_config()
        normalized_system_prompt = self._normalize_prompt_payload(system_prompt)
        normalized_user_prompt = self._normalize_prompt_payload(user_prompt)

        if config.provider == "openai":
            return self._call_openai(
                config,
                normalized_system_prompt,
                normalized_user_prompt,
                response_schema=response_schema,
                max_output_tokens=max_output_tokens,
                reasoning_effort=reasoning_effort,
                verbosity=verbosity,
            )
        if config.provider == "anthropic":
            return self._call_anthropic(
                config,
                normalized_system_prompt,
                normalized_user_prompt,
                response_schema=response_schema,
                max_output_tokens=max_output_tokens,
            )

        raise AIServiceConfigurationError("Unsupported AI provider.")

    def improve_question(self, survey_title, question_type, question_text):
        normalized_question_text = self._clean_prompt_text(
            question_text,
            limit=MAX_PROMPT_TEXT_LENGTH,
        )
        if not normalized_question_text:
            raise AIServiceRequestError("Add question text before using AI improve.")

        normalized_survey_title = self._clean_prompt_text(
            survey_title,
            limit=MAX_SURVEY_TITLE_LENGTH,
        ) or "Untitled survey"
        normalized_question_type = self._clean_prompt_text(question_type, limit=80) or "Question"

        system_prompt = (
            "You improve survey question copy for professional, user-friendly forms. "
            "Return only the improved question text. Preserve the original intent, "
            "language, placeholders, variables, and answerability. Do not add quotes, "
            "markdown, numbering, explanations, or answer options. "
            "If the current wording is already strong for the provided context, "
            "return the original question text exactly unchanged."
        )
        user_prompt = (
            f"Survey title: {normalized_survey_title}\n"
            f"Question type: {normalized_question_type}\n"
            f"Original question: {normalized_question_text}\n\n"
            "Rewrite this as a clearer, more engaging survey question."
        )

        improved_text = self.call(
            system_prompt,
            user_prompt,
            max_output_tokens=1000,
        )
        cleaned_output = self._normalize_improved_text(improved_text)
        if not cleaned_output:
            raise AIServiceRequestError("The AI provider returned an empty response.")
        return cleaned_output

    def _call_openai(
        self,
        config,
        system_prompt,
        user_prompt,
        *,
        response_schema=None,
        max_output_tokens=2400,
        reasoning_effort="low",
        verbosity=None,
    ):
        if response_schema:
            try:
                self._debug_log_ai_exchange(
                    provider="openai",
                    model=config.model,
                    attempt="json_schema",
                    phase="request",
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )
                response_payload = self._request_json(
                    OPENAI_API_URL,
                    self._build_openai_payload(
                        config,
                        system_prompt,
                        user_prompt,
                        response_schema=response_schema,
                        max_output_tokens=max_output_tokens,
                        reasoning_effort=reasoning_effort,
                        verbosity=verbosity,
                    ),
                    headers={
                        "Authorization": f"Bearer {config.api_key}",
                        "Content-Type": "application/json",
                    },
                )
                self._debug_log_ai_exchange(
                    provider="openai",
                    model=config.model,
                    attempt="json_schema",
                    phase="response",
                    response_payload=response_payload,
                )
                return self._parse_openai_response(
                    response_payload,
                    response_schema=response_schema,
                )
            except AIServiceRequestError as exc:
                self._debug_log_ai_exchange(
                    provider="openai",
                    model=config.model,
                    attempt="json_schema",
                    phase="error",
                    error_message=str(exc),
                )
                if not self._should_retry_openai_with_json_mode(exc):
                    raise
                fallback_system_prompt = self._build_openai_json_mode_system_prompt(
                    system_prompt,
                    response_schema,
                )
                fallback_user_prompt = self._build_openai_json_mode_user_prompt(
                    user_prompt
                )
                self._debug_log_ai_exchange(
                    provider="openai",
                    model=config.model,
                    attempt="json_object_fallback",
                    phase="request",
                    system_prompt=fallback_system_prompt,
                    user_prompt=fallback_user_prompt,
                )
                response_payload = self._request_json(
                    OPENAI_API_URL,
                    self._build_openai_payload(
                        config,
                        fallback_system_prompt,
                        fallback_user_prompt,
                        response_schema=None,
                        max_output_tokens=max_output_tokens,
                        json_mode=True,
                        reasoning_effort=reasoning_effort,
                        verbosity=verbosity,
                    ),
                    headers={
                        "Authorization": f"Bearer {config.api_key}",
                        "Content-Type": "application/json",
                    },
                )
                self._debug_log_ai_exchange(
                    provider="openai",
                    model=config.model,
                    attempt="json_object_fallback",
                    phase="response",
                    response_payload=response_payload,
                )
                return self._parse_openai_response(
                    response_payload,
                    response_schema=response_schema,
                )

        self._debug_log_ai_exchange(
            provider="openai",
            model=config.model,
            attempt="plain_text",
            phase="request",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
        response_payload = self._request_json(
            OPENAI_API_URL,
            self._build_openai_payload(
                config,
                system_prompt,
                user_prompt,
                response_schema=None,
                max_output_tokens=max_output_tokens,
                reasoning_effort=reasoning_effort,
                verbosity=verbosity,
            ),
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
        )
        self._debug_log_ai_exchange(
            provider="openai",
            model=config.model,
            attempt="plain_text",
            phase="response",
            response_payload=response_payload,
        )
        return self._parse_openai_response(
            response_payload,
            response_schema=None,
        )

    def _build_openai_payload(
        self,
        config,
        system_prompt,
        user_prompt,
        *,
        response_schema=None,
        max_output_tokens=2400,
        json_mode=False,
        reasoning_effort="low",
        verbosity=None,
    ):
        payload = {
            "model": config.model,
            "instructions": system_prompt,
            "input": user_prompt,
            "max_output_tokens": max_output_tokens,
        }
        if self._should_use_openai_reasoning(config.model) and reasoning_effort:
            payload["reasoning"] = {"effort": reasoning_effort}
        if response_schema:
            payload["text"] = {
                "format": {
                    "type": "json_schema",
                    "name": "questiz_structured_response",
                    "strict": True,
                    "schema": response_schema,
                }
            }
        elif json_mode:
            payload["text"] = {
                "format": {
                    "type": "json_object",
                }
            }
        elif verbosity:
            payload["text"] = {
                "format": {"type": "text"},
                "verbosity": verbosity,
            }
        return payload

    def _parse_openai_response(self, response_payload, *, response_schema=None):
        status = (response_payload.get("status") or "").strip().lower()
        refusal = self._extract_openai_refusal(response_payload)
        if refusal:
            raise AIServiceRequestError(refusal)

        if response_schema:
            parsed_output = self._coerce_to_schema_shape(
                self._extract_openai_structured_output(response_payload),
                response_schema,
            )
            if parsed_output is not None:
                return parsed_output

        response_text = self._extract_openai_text(response_payload)
        if response_text and status in {"completed", "incomplete"}:
            if response_schema:
                return self._parse_json_text(
                    response_text,
                    response_schema=response_schema,
                )
            return response_text

        if status == "incomplete":
            incomplete_reason = (
                response_payload.get("incomplete_details", {}).get("reason")
                or "response_incomplete"
            )
            raise AIServiceRequestError(
                f"The OpenAI response was incomplete ({incomplete_reason})."
            )
        if status != "completed":
            raise AIServiceRequestError("The OpenAI request did not complete.")
        raise AIServiceRequestError("The OpenAI response did not contain text.")

    def _build_openai_json_mode_system_prompt(self, system_prompt, response_schema):
        return (
            f"{system_prompt}\n\n"
            "Return only valid JSON matching this schema. Do not include prose, markdown, or code fences.\n"
            f"{json.dumps(response_schema, separators=(',', ':'))}"
        )

    def _build_openai_json_mode_user_prompt(self, user_prompt):
        return (
            f"{user_prompt}\n\n"
            "Return a valid JSON object only."
        )

    def _should_retry_openai_with_json_mode(self, exc):
        message = str(exc or "").strip().lower()
        return any(
            marker in message
            for marker in [
                "invalid json",
                "did not contain text",
                "json_schema",
                "structured output",
                "structured outputs",
                "text.format",
                "response_format",
                "schema",
            ]
        )

    def _call_anthropic(
        self,
        config,
        system_prompt,
        user_prompt,
        *,
        response_schema=None,
        max_output_tokens=2400,
    ):
        normalized_system_prompt = system_prompt
        if response_schema:
            normalized_system_prompt = (
                f"{system_prompt}\n\n"
                "Return only valid JSON matching this schema. Do not include prose or markdown.\n"
                f"{json.dumps(response_schema, separators=(',', ':'))}"
            )

        payload = {
            "model": config.model,
            "system": normalized_system_prompt,
            "max_tokens": max_output_tokens,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        response_payload = self._request_json(
            ANTHROPIC_API_URL,
            payload,
            headers={
                "x-api-key": config.api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
        )

        text_blocks = [
            block.get("text", "")
            for block in response_payload.get("content", [])
            if block.get("type") == "text"
        ]
        response_text = "\n".join(block for block in text_blocks if block).strip()
        if not response_text:
            raise AIServiceRequestError("The Anthropic response did not contain text.")

        if response_schema:
            return self._parse_json_text(
                response_text,
                response_schema=response_schema,
            )
        return response_text

    def _request_json(self, url, payload, *, headers):
        http_request = request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(http_request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
                try:
                    return json.loads(response.read().decode("utf-8"))
                except json.JSONDecodeError as exc:
                    raise AIServiceRequestError(
                        "The AI provider returned malformed JSON."
                    ) from exc
        except error.HTTPError as exc:
            raise AIServiceRequestError(self._extract_http_error_message(exc)) from exc
        except error.URLError as exc:
            raise AIServiceRequestError("Could not reach the AI provider.") from exc
        except TimeoutError as exc:
            raise AIServiceRequestError("The AI request timed out.") from exc

    def _extract_http_error_message(self, exc):
        message = str(exc.reason or "The AI provider rejected the request.")
        try:
            payload = json.loads(exc.read().decode("utf-8"))
        except Exception:
            return message

        if isinstance(payload.get("error"), dict):
            return str(payload["error"].get("message") or message)
        return str(payload.get("message") or message)

    def _parse_json_text(self, value, *, response_schema=None):
        normalized = (value or "").strip()
        if not normalized:
            raise AIServiceRequestError("The AI provider returned invalid JSON.")

        decoder = json.JSONDecoder()
        candidates = []
        seen = set()

        def add_candidate(candidate):
            cleaned = (candidate or "").strip()
            if not cleaned or cleaned in seen:
                return
            seen.add(cleaned)
            candidates.append(cleaned)

        add_candidate(normalized)

        if normalized.startswith("```") and normalized.endswith("```"):
            unfenced = normalized.strip("`").strip()
            if unfenced.lower().startswith("json"):
                unfenced = unfenced[4:].strip()
            add_candidate(unfenced)

        for match in re.finditer(r"```(?:json)?\s*(.*?)```", normalized, re.IGNORECASE | re.DOTALL):
            add_candidate(match.group(1))

        candidate_wrappers = [("{", "}"), ("[", "]")]
        if isinstance(response_schema, dict):
            expected_type = response_schema.get("type")
            if expected_type == "object":
                candidate_wrappers = [("{", "}")]
            elif expected_type == "array":
                candidate_wrappers = [("[", "]")]

        for opener, closer in candidate_wrappers:
            start = normalized.find(opener)
            end = normalized.rfind(closer)
            if start != -1 and end != -1 and end > start:
                add_candidate(normalized[start : end + 1])

        for candidate in candidates:
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                try:
                    parsed, _end = decoder.raw_decode(candidate.lstrip())
                except json.JSONDecodeError:
                    continue
            coerced = self._coerce_to_schema_shape(parsed, response_schema)
            if coerced is not None:
                return coerced

        raise AIServiceRequestError("The AI provider returned invalid JSON.")

    def _matches_response_schema_shape(self, parsed, response_schema):
        if response_schema in (None, ""):
            return True
        if not isinstance(response_schema, dict):
            return True

        expected_type = response_schema.get("type")
        if expected_type == "object":
            if not isinstance(parsed, dict):
                return False
            required_keys = response_schema.get("required") or []
            return all(key in parsed for key in required_keys)
        if expected_type == "array":
            if not isinstance(parsed, list):
                return False
            min_items = response_schema.get("minItems")
            if isinstance(min_items, int) and len(parsed) < min_items:
                return False
            return True
        return True

    def _coerce_to_schema_shape(self, parsed, response_schema):
        if self._matches_response_schema_shape(parsed, response_schema):
            return parsed
        if response_schema in (None, "") or not isinstance(response_schema, dict):
            return None

        expected_type = response_schema.get("type")
        if expected_type == "object":
            if isinstance(parsed, list):
                for item in parsed:
                    if self._matches_response_schema_shape(item, response_schema):
                        return item
                    if isinstance(item, str):
                        try:
                            nested = self._parse_json_text(
                                item,
                                response_schema=response_schema,
                            )
                        except AIServiceRequestError:
                            continue
                        return nested
            if isinstance(parsed, str):
                try:
                    return self._parse_json_text(
                        parsed,
                        response_schema=response_schema,
                    )
                except AIServiceRequestError:
                    return None
        if expected_type == "array" and isinstance(parsed, str):
            try:
                return self._parse_json_text(
                    parsed,
                    response_schema=response_schema,
                )
            except AIServiceRequestError:
                return None
        return None

    def _clean_prompt_text(self, value, *, limit):
        normalized = " ".join((value or "").strip().split())
        if not normalized:
            return ""
        return normalized[:limit]

    def _normalize_improved_text(self, value):
        normalized = (value or "").strip()
        if normalized.startswith("```") and normalized.endswith("```"):
            normalized = normalized.strip("`").strip()
            if normalized.lower().startswith("json"):
                normalized = normalized[4:].strip()

        if (
            len(normalized) >= 2
            and normalized[0] == normalized[-1]
            and normalized[0] in {'"', "'"}
        ):
            normalized = normalized[1:-1].strip()

        normalized = " ".join(normalized.split())
        return normalized[:MAX_PROMPT_TEXT_LENGTH]

    def _normalize_prompt_payload(self, value):
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=True)

    def _should_use_openai_reasoning(self, model):
        normalized_model = (model or "").strip().lower()
        return normalized_model.startswith(("gpt-5", "o1", "o3", "o4"))

    def _extract_openai_text(self, response_payload):
        direct_output_text = (response_payload.get("output_text") or "").strip()
        if direct_output_text:
            return direct_output_text

        collected_parts = []
        for item in response_payload.get("output", []):
            if not isinstance(item, dict):
                continue
            for content_part in item.get("content", []):
                if not isinstance(content_part, dict):
                    continue
                part_type = (content_part.get("type") or "").strip().lower()
                if part_type in {"output_text", "text"} and content_part.get("text"):
                    collected_parts.append(content_part["text"])

        return "\n".join(part.strip() for part in collected_parts if part and part.strip()).strip()

    def _extract_openai_structured_output(self, response_payload):
        direct_parsed = response_payload.get("output_parsed")
        if isinstance(direct_parsed, (dict, list)):
            return direct_parsed

        for item in response_payload.get("output", []):
            if not isinstance(item, dict):
                continue
            for content_part in item.get("content", []):
                if not isinstance(content_part, dict):
                    continue
                parsed = content_part.get("parsed")
                if isinstance(parsed, (dict, list)):
                    return parsed
                raw_json = content_part.get("json")
                if isinstance(raw_json, (dict, list)):
                    return raw_json

        return None

    def _extract_openai_refusal(self, response_payload):
        for item in response_payload.get("output", []):
            if not isinstance(item, dict):
                continue
            for content_part in item.get("content", []):
                if not isinstance(content_part, dict):
                    continue
                if (content_part.get("type") or "").strip().lower() == "refusal":
                    refusal = (content_part.get("refusal") or "").strip()
                    if refusal:
                        return refusal
        return ""

    def _debug_log_ai_exchange(
        self,
        *,
        provider,
        model,
        attempt,
        phase,
        system_prompt=None,
        user_prompt=None,
        response_payload=None,
        error_message=None,
    ):
        if not self._debug_logging_enabled():
            return

        payload = json.dumps(
            {
                "provider": provider,
                "model": model,
                "attempt": attempt,
                "phase": phase,
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
                "response_payload": response_payload,
                "error_message": error_message,
            },
            ensure_ascii=False,
            default=str,
        )
        logger.warning("AI DEBUG %s", payload)
        print(
            "\n".join(
                [
                    "AI DEBUG START",
                    f"provider={provider}",
                    f"model={model}",
                    f"attempt={attempt}",
                    f"phase={phase}",
                    f"system_prompt={system_prompt}",
                    f"user_prompt={user_prompt}",
                    f"response_payload={json.dumps(response_payload, ensure_ascii=False, default=str) if response_payload is not None else None}",
                    f"error_message={error_message}",
                    "AI DEBUG END",
                ]
            ),
            flush=True,
        )

    def _debug_logging_enabled(self):
        return (
            os.environ.get(AI_DEBUG_ENV_VAR, "").strip().lower()
            in {"1", "true", "yes", "on"}
        )
