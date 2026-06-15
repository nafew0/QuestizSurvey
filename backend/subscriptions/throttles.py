from django.conf import settings
from django.core.cache import cache
from rest_framework.throttling import SimpleRateThrottle

from questizsurvey.client_ip import get_client_ip


class PaymentCheckoutThrottle(SimpleRateThrottle):
    scope = "payment_checkout"
    rate = None
    default_rate = "10/hour"

    def get_rate(self):
        return getattr(settings, "PAYMENT_CHECKOUT_RATE_LIMIT", self.default_rate)

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }


class PaymentStatusThrottle(SimpleRateThrottle):
    scope = "payment_status"
    rate = None
    default_rate = "60/hour"

    def get_rate(self):
        return getattr(settings, "PAYMENT_STATUS_RATE_LIMIT", self.default_rate)

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }


BKASH_CALLBACK_WINDOW_SECONDS = 60 * 60
BKASH_CALLBACK_MAX_ATTEMPTS = 30


def get_bkash_callback_cache_key(ip_address):
    return f"subscriptions:bkash-callback:{ip_address or 'unknown'}"


def should_throttle_bkash_callback(ip_address):
    cache_key = get_bkash_callback_cache_key(ip_address)
    window_seconds = getattr(
        settings,
        "BKASH_CALLBACK_WINDOW_SECONDS",
        BKASH_CALLBACK_WINDOW_SECONDS,
    )
    max_attempts = getattr(
        settings,
        "BKASH_CALLBACK_MAX_ATTEMPTS",
        BKASH_CALLBACK_MAX_ATTEMPTS,
    )

    try:
        added = cache.add(cache_key, 1, timeout=window_seconds)
        if added:
            return False

        attempts = cache.incr(cache_key)
        return attempts > max_attempts
    except Exception:
        return False


def get_bkash_callback_ip(request):
    return get_client_ip(request)
