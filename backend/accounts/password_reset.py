from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes

from .models import User


def build_password_reset_link(user):
    public_app_url = (getattr(settings, "PUBLIC_APP_URL", "") or "").rstrip("/")
    if not public_app_url:
        raise ImproperlyConfigured(
            "PUBLIC_APP_URL must be configured for password reset emails."
        )

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{public_app_url}/reset-password?uid={uid}&token={token}", uid, token


def resolve_password_reset_user(uid):
    if not uid:
        return None

    try:
        user_id = urlsafe_base64_decode(uid).decode()
    except (TypeError, ValueError, OverflowError):
        return None

    return User.objects.filter(pk=user_id, is_active=True).first()


def is_password_reset_token_valid(uid, token):
    user = resolve_password_reset_user(uid)
    if not user or not token:
        return None

    if not default_token_generator.check_token(user, token):
        return None
    return user


def send_password_reset_email(user, *, requested_by=None):
    reset_url, uid, token = build_password_reset_link(user)
    context = {
        "user": user,
        "reset_url": reset_url,
        "requested_by": requested_by,
    }
    subject = "Reset your Questiz password"
    html_body = render_to_string("emails/password_reset.html", context)
    text_body = strip_tags(html_body)

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@questiz.local"),
        to=[user.email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)
    return {"uid": uid, "token": token, "reset_url": reset_url}
