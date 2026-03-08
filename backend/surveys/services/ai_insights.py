import json
import os
from urllib import error, request


class AnalyticsTextInsightsService:
    """Optional ChatGPT-powered narrative insights for analytics payloads."""

    api_url = "https://api.openai.com/v1/responses"

    def __init__(self):
        self.api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        self.model = os.environ.get("OPENAI_RESPONSES_MODEL", "").strip()

    @property
    def enabled(self):
        return bool(self.api_key and self.model)

    def build_insights(self, survey_title, insight_type, analytics_payload):
        if not self.enabled:
            return {
                "available": False,
                "source": "openai",
                "reason": "OpenAI API is not configured.",
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

        payload = {
            "model": self.model,
            "input": [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "You are an analytics assistant for survey data. "
                                "Return concise, factual, non-speculative insights in JSON."
                            ),
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": json.dumps(
                                {
                                    "survey_title": survey_title,
                                    "insight_type": insight_type,
                                    "analytics_payload": analytics_payload,
                                }
                            ),
                        }
                    ],
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "analytics_insights",
                    "strict": True,
                    "schema": schema,
                }
            },
        }

        http_request = request.Request(
            self.api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with request.urlopen(http_request, timeout=20) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            return {
                "available": False,
                "source": "openai",
                "reason": str(exc),
                "headline": "",
                "bullets": [],
            }

        if response_payload.get("status") != "completed":
            return {
                "available": False,
                "source": "openai",
                "reason": response_payload.get("status", "request_failed"),
                "headline": "",
                "bullets": [],
            }

        response_text = response_payload.get("output_text", "")
        if not response_text:
            return {
                "available": False,
                "source": "openai",
                "reason": "No output_text was returned.",
                "headline": "",
                "bullets": [],
            }

        try:
            parsed = json.loads(response_text)
        except json.JSONDecodeError as exc:
            return {
                "available": False,
                "source": "openai",
                "reason": str(exc),
                "headline": "",
                "bullets": [],
            }

        return {
            "available": True,
            "source": "openai",
            "headline": parsed.get("headline", ""),
            "bullets": parsed.get("bullets", []),
        }
