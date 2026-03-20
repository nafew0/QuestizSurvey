from rest_framework.throttling import SimpleRateThrottle

from questizsurvey.client_ip import get_client_ip


class PublicSurveyWriteThrottle(SimpleRateThrottle):
    scope = "public_survey_write"
    rate = "60/hour"

    def get_cache_key(self, request, view):
        survey_slug = (view.kwargs.get("slug") or "").strip()
        if not survey_slug:
            return None

        if request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        else:
            client_ip = get_client_ip(request) or "unknown"
            ident = f"ip:{client_ip}"

        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{survey_slug}:{ident}",
        }

