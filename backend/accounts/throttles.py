import hashlib

from rest_framework.throttling import SimpleRateThrottle

from .verification import get_request_ip_address


def _hash_identifier(value):
    normalized = (value or "").strip().lower()
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class LoginRateThrottle(SimpleRateThrottle):
    scope = "public_login"
    rate = "10/min"

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
    rate = "5/hour"

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
