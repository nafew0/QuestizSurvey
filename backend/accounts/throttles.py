import hashlib

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle

from .verification import get_request_ip_address


def _hash_identifier(value):
    normalized = (value or "").strip().lower()
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class LoginRateThrottle(SimpleRateThrottle):
    scope = "public_login"
    rate = None
    default_rate = "10/min"

    def get_rate(self):
        return getattr(settings, "PUBLIC_LOGIN_RATE_LIMIT", self.default_rate)

    def get_cache_key(self, request, view):
        identifier = _hash_identifier(
            request.data.get("username") or request.data.get("identifier") or ""
        )
        client_ip = get_request_ip_address(request) or "unknown"
        ident = f"{client_ip}:{identifier}" if identifier else client_ip
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }


class RegisterRateThrottle(SimpleRateThrottle):
    scope = "public_register"
    rate = None
    default_rate = "10/hour"

    def get_rate(self):
        return getattr(settings, "PUBLIC_REGISTER_RATE_LIMIT", self.default_rate)

    def get_cache_key(self, request, view):
        identifier = _hash_identifier(
            request.data.get("email") or request.data.get("username") or ""
        )
        client_ip = get_request_ip_address(request) or "unknown"
        ident = f"{client_ip}:{identifier}" if identifier else client_ip
        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }


class TokenRefreshRateThrottle(SimpleRateThrottle):
    scope = "public_token_refresh"
    rate = None
    default_rate = "20/hour"

    def get_rate(self):
        return getattr(settings, "PUBLIC_TOKEN_REFRESH_RATE_LIMIT", self.default_rate)

    def get_cache_key(self, request, view):
        client_ip = get_request_ip_address(request) or "unknown"
        return self.cache_format % {
            "scope": self.scope,
            "ident": client_ip,
        }


class AdminRateThrottle(SimpleRateThrottle):
    scope = "admin_api"
    rate = None
    default_rate = "100/hour"

    def get_rate(self):
        return getattr(settings, "ADMIN_API_RATE_LIMIT", self.default_rate)

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }
