import logging

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

from .models import EmailVerificationToken, SiteSettings

logger = logging.getLogger(__name__)

VERIFICATION_EMAIL_COOLDOWN_SECONDS = 120
PUBLIC_RESEND_WINDOW_SECONDS = 15 * 60
PUBLIC_RESEND_MAX_ATTEMPTS = 10


def get_site_settings():
    site_settings, _ = SiteSettings.objects.get_or_create(pk=1)
    return site_settings


def is_email_verification_required():
    return get_site_settings().require_email_verification


def mask_email(email):
    if not email or "@" not in email:
        return ""

    local_part, domain = email.split("@", 1)
    masked_local = _mask_segment(local_part)
    domain_name, dot, suffix = domain.partition(".")
    masked_domain = _mask_segment(domain_name)

    if dot:
        return f"{masked_local}@{masked_domain}.{suffix}"
    return f"{masked_local}@{masked_domain}"


def _mask_segment(value):
    if not value:
        return ""
    if len(value) <= 2:
        return f"{value[0]}*" if len(value) == 2 else "*"
    if len(value) == 3:
        return f"{value[0]}*{value[-1]}"
    return f"{value[0]}{'*' * (len(value) - 2)}{value[-1]}"


def build_verification_url(token):
    public_app_url = getattr(settings, "PUBLIC_APP_URL", "").rstrip("/")
    if not public_app_url:
        raise ValueError("PUBLIC_APP_URL is required for email verification.")
    return f"{public_app_url}/verify-email?token={token}"


def get_user_verification_retry_after_seconds(user):
    latest_token = (
        EmailVerificationToken.objects.filter(user=user)
        .order_by("-created_at")
        .only("created_at")
        .first()
    )
    if not latest_token:
        return 0

    elapsed_seconds = int((timezone.now() - latest_token.created_at).total_seconds())
    retry_after = VERIFICATION_EMAIL_COOLDOWN_SECONDS - elapsed_seconds
    return max(retry_after, 0)


@transaction.atomic
def issue_email_verification_token(user):
    EmailVerificationToken.objects.filter(user=user, used=False).delete()
    return EmailVerificationToken.objects.create(user=user)


def deliver_verification_email(user, verification_token):
    verification_url = build_verification_url(verification_token.token)
    public_app_url = getattr(settings, "PUBLIC_APP_URL", "").rstrip("/")
    logo_url = f"{public_app_url}/branding/logo.svg" if public_app_url else ""
    expires_in_hours = 24
    context = {
        "user": user,
        "verification_url": verification_url,
        "logo_url": logo_url,
        "expires_in_hours": expires_in_hours,
    }
    html_message = render_to_string("emails/verify_email.html", context)
    plain_message = strip_tags(html_message)

    send_mail(
        subject="Verify your Questiz email",
        message=plain_message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@questiz.local"),
        recipient_list=[user.email],
        html_message=html_message,
        fail_silently=False,
    )


def send_verification_email(user):
    verification_token = issue_email_verification_token(user)
    try:
        deliver_verification_email(user, verification_token)
    except Exception:
        verification_token.delete()
        raise
    return verification_token


def get_public_resend_cache_key(ip_address):
    return f"accounts:verification:public-resend:{ip_address or 'unknown'}"


def should_throttle_public_resend(ip_address):
    cache_key = get_public_resend_cache_key(ip_address)

    try:
        added = cache.add(cache_key, 1, timeout=PUBLIC_RESEND_WINDOW_SECONDS)
        if added:
            return False

        attempts = cache.incr(cache_key)
        return attempts > PUBLIC_RESEND_MAX_ATTEMPTS
    except Exception:  # pragma: no cover - cache failures should not break auth
        logger.warning("Public resend throttle unavailable.", exc_info=True)
        return False


def get_request_ip_address(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return (request.META.get("REMOTE_ADDR") or "").strip()
