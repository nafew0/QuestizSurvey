from django.urls import path

from .views import CurrentSubscriptionView, PlanListView, SubscriptionUsageView
from .stripe_views import (
    StripeCheckoutView,
    StripeConfigView,
    StripeCustomerPortalView,
    stripe_webhook_view,
)


app_name = "subscriptions"

urlpatterns = [
    path("plans/", PlanListView.as_view(), name="plan-list"),
    path("subscription/", CurrentSubscriptionView.as_view(), name="subscription-detail"),
    path("subscription/usage/", SubscriptionUsageView.as_view(), name="subscription-usage"),
    path("payments/stripe/config/", StripeConfigView.as_view(), name="stripe-config"),
    path(
        "payments/stripe/create-checkout/",
        StripeCheckoutView.as_view(),
        name="stripe-create-checkout",
    ),
    path(
        "payments/stripe/customer-portal/",
        StripeCustomerPortalView.as_view(),
        name="stripe-customer-portal",
    ),
    path("payments/stripe/webhook/", stripe_webhook_view, name="stripe-webhook"),
]
