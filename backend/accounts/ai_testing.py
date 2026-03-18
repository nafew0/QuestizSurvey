import json
from urllib import error, request


class AITestConnectionError(Exception):
    pass


class AITestService:
    OPENAI_URL = "https://api.openai.com/v1/responses"
    ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

    @classmethod
    def test_connection(cls, *, provider, model, api_key):
        normalized_provider = (provider or "").strip().lower()
        normalized_model = (model or "").strip()
        normalized_key = (api_key or "").strip()

        if not normalized_provider:
            raise AITestConnectionError("Select an AI provider first.")
        if not normalized_model:
            raise AITestConnectionError("Provide a model name first.")
        if not normalized_key:
            raise AITestConnectionError("Provide an API key first.")

        if normalized_provider == "openai":
            return cls._test_openai(normalized_model, normalized_key)
        if normalized_provider == "anthropic":
            return cls._test_anthropic(normalized_model, normalized_key)
        raise AITestConnectionError("Unsupported AI provider.")

    @classmethod
    def _read_response(cls, response):
        try:
            return json.loads(response.read().decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise AITestConnectionError("The AI provider returned malformed JSON.") from exc

    @classmethod
    def _request(cls, http_request):
        try:
            with request.urlopen(http_request, timeout=20) as response:
                return cls._read_response(response)
        except error.HTTPError as exc:
            message = exc.reason
            try:
                payload = json.loads(exc.read().decode("utf-8"))
                message = payload.get("error", {}).get("message") or payload.get(
                    "message"
                ) or message
            except Exception:
                pass
            raise AITestConnectionError(str(message)) from exc
        except error.URLError as exc:
            raise AITestConnectionError("Could not reach the AI provider.") from exc

    @classmethod
    def _test_openai(cls, model, api_key):
        payload = {
            "model": model,
            "input": "Reply with OK.",
            "max_output_tokens": 20,
        }
        http_request = request.Request(
            cls.OPENAI_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        response_payload = cls._request(http_request)
        if response_payload.get("status") != "completed":
            raise AITestConnectionError("The OpenAI request did not complete.")
        return {
            "provider": "openai",
            "model": model,
            "message": "OpenAI connection succeeded.",
        }

    @classmethod
    def _test_anthropic(cls, model, api_key):
        payload = {
            "model": model,
            "max_tokens": 16,
            "messages": [{"role": "user", "content": "Reply with OK."}],
        }
        http_request = request.Request(
            cls.ANTHROPIC_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            method="POST",
        )
        response_payload = cls._request(http_request)
        if not response_payload.get("id"):
            raise AITestConnectionError("The Anthropic request did not complete.")
        return {
            "provider": "anthropic",
            "model": model,
            "message": "Anthropic connection succeeded.",
        }
