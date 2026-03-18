import json
import os
from dataclasses import dataclass
from urllib import error, request

from accounts.models import SiteSettings


OPENAI_API_URL = "https://api.openai.com/v1/responses"
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_TIMEOUT_SECONDS = 30
MAX_PROMPT_TEXT_LENGTH = 4000
MAX_SURVEY_TITLE_LENGTH = 200


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
        max_output_tokens=240,
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
            max_output_tokens=320,
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
        max_output_tokens=240,
    ):
        payload = {
            "model": config.model,
            "instructions": system_prompt,
            "input": user_prompt,
            "max_output_tokens": max_output_tokens,
        }
        if self._should_use_openai_reasoning(config.model):
            payload["reasoning"] = {"effort": "low"}
        if response_schema:
            payload["text"] = {
                "format": {
                    "type": "json_schema",
                    "name": "questiz_structured_response",
                    "strict": True,
                    "schema": response_schema,
                }
            }

        response_payload = self._request_json(
            OPENAI_API_URL,
            payload,
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
        )
        status = (response_payload.get("status") or "").strip().lower()
        response_text = self._extract_openai_text(response_payload)
        if response_text and status in {"completed", "incomplete"}:
            if response_schema:
                return self._parse_json_text(response_text)
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

    def _call_anthropic(
        self,
        config,
        system_prompt,
        user_prompt,
        *,
        response_schema=None,
        max_output_tokens=240,
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
            return self._parse_json_text(response_text)
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

    def _parse_json_text(self, value):
        try:
            return json.loads(value)
        except json.JSONDecodeError as exc:
            raise AIServiceRequestError("The AI provider returned invalid JSON.") from exc

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
