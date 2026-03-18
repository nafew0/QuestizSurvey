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
