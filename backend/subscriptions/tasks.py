from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from celery import shared_task
from dateutil.relativedelta import relativedelta

from .models import UserSubscription
from .services import LicenseService

REMINDER_CACHE_PREFIX = "subscriptions:bkash:renewal-reminder"


def _build_profile_url():
    base_url = (getattr(settings, "PUBLIC_APP_URL", "") or "").rstrip("/")
    if not base_url:
        return ""
    return f"{base_url}/profile"


def _send_email(subject, message, recipient_email):
    if not recipient_email:
        return

    send_mail(
        subject=subject,
        message=message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@questiz.local"),
        recipient_list=[recipient_email],
        fail_silently=False,
    )


def _should_send_reminder(subscription):
    cache_key = f"{REMINDER_CACHE_PREFIX}:{subscription.id}:{subscription.current_period_end:%Y%m%d}"
    try:
        return cache.add(cache_key, 1, timeout=4 * 24 * 60 * 60)
    except Exception:  # pragma: no cover - cache failures should not break billing
        return True


@shared_task
def check_expiring_subscriptions():
    now = timezone.now()
    cutoff = now + relativedelta(days=LicenseService.BKASH_REMINDER_WINDOW_DAYS)
    renew_url = _build_profile_url()

    subscriptions = UserSubscription.objects.select_related("user", "plan").filter(
        payment_provider=UserSubscription.PaymentProvider.BKASH,
        status=UserSubscription.Status.ACTIVE,
        cancel_at_period_end=False,
        current_period_end__gt=now,
        current_period_end__lte=cutoff,
    )

    sent_count = 0
    for subscription in subscriptions:
        if not _should_send_reminder(subscription):
            continue

        renewal_line = (
            f"Renew now from your Questiz profile: {renew_url}"
            if renew_url
            else "Log in to Questiz and renew from your profile."
        )
        _send_email(
            subject=f"Your Questiz {subscription.plan.name} plan expires soon",
            message=(
                f"Your Questiz {subscription.plan.name} subscription expires on "
                f"{timezone.localtime(subscription.current_period_end).strftime('%B %d, %Y %H:%M %Z')}.\n\n"
                f"{renewal_line}\n"
            ),
            recipient_email=subscription.user.email,
        )
        sent_count += 1

    return sent_count


@shared_task
def check_expired_subscriptions():
    grace_cutoff = timezone.now() - relativedelta(
        days=LicenseService.BKASH_GRACE_PERIOD_DAYS
    )
    profile_url = _build_profile_url()

    subscriptions = (
        UserSubscription.objects.select_related("user", "plan")
        .filter(
            payment_provider=UserSubscription.PaymentProvider.BKASH,
            current_period_end__isnull=False,
            current_period_end__lte=grace_cutoff,
        )
        .exclude(plan__slug=LicenseService.FREE_PLAN_SLUG)
    )

    downgraded_count = 0
    for subscription in subscriptions:
        with transaction.atomic():
            locked_subscription = (
                UserSubscription.objects.select_related("user", "plan")
                .select_for_update()
                .get(pk=subscription.pk)
            )
            if (
                locked_subscription.plan.slug == LicenseService.FREE_PLAN_SLUG
                or locked_subscription.payment_provider
                != UserSubscription.PaymentProvider.BKASH
                or not locked_subscription.current_period_end
                or locked_subscription.current_period_end > grace_cutoff
            ):
                continue

            previous_plan_name = locked_subscription.plan.name
            previous_state = LicenseService.serialize_subscription_state(
                locked_subscription
            )
            LicenseService.downgrade_to_free(
                locked_subscription,
                event_metadata={"previous_state": previous_state},
            )

        _send_email(
            subject="Your Questiz subscription has expired",
            message=(
                f"Your Questiz {previous_plan_name} subscription was downgraded to Free after "
                f"the {LicenseService.BKASH_GRACE_PERIOD_DAYS}-day grace period ended.\n\n"
                f"{f'You can renew from your profile: {profile_url}' if profile_url else 'Log in to Questiz to renew at any time.'}\n"
            ),
            recipient_email=subscription.user.email,
        )
        downgraded_count += 1

    return downgraded_count
