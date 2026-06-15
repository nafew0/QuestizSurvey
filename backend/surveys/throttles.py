from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle

from questizsurvey.client_ip import get_client_ip


class PublicSurveyStartThrottle(SimpleRateThrottle):
    """
    Throttles POST /s/<slug>/ (new response creation).

    Keyed by IP + survey slug. The rate is intentionally generous to
    accommodate live events where many respondents share one public IP
    (e.g. conference WiFi), while still limiting automated flooding.
    """

    scope = "public_survey_start"
    rate = None
    default_rate = "300/hour"

    def get_rate(self):
        return getattr(settings, "PUBLIC_SURVEY_START_RATE_LIMIT", self.default_rate)

    def get_cache_key(self, request, view):
        survey_slug = (view.kwargs.get("slug") or "").strip()
        if not survey_slug:
            return None

        if request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        else:
            ident = f"ip:{get_client_ip(request) or 'unknown'}"

        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{survey_slug}:{ident}",
        }


class PublicSurveyUpdateThrottle(SimpleRateThrottle):
    """
    Throttles PUT /s/<slug>/ (page-by-page saves).

    Keyed by resume_token when present, so every respondent gets their
    own independent counter even when hundreds of people share one IP
    (e.g. a live event on a single WiFi network). Falls back to IP if
    no token is in the request.
    """

    scope = "public_survey_update"
    rate = None
    default_rate = "120/hour"

    def get_rate(self):
        return getattr(settings, "PUBLIC_SURVEY_UPDATE_RATE_LIMIT", self.default_rate)

    def get_cache_key(self, request, view):
        survey_slug = (view.kwargs.get("slug") or "").strip()
        if not survey_slug:
            return None

        if request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        else:
            resume_token = (request.data.get("resume_token") or "").strip()
            if resume_token:
                ident = f"resume:{resume_token}"
            else:
                ident = f"ip:{get_client_ip(request) or 'unknown'}"

        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{survey_slug}:{ident}",
        }
