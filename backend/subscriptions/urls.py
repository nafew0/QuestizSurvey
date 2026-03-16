from django.urls import path

from .views import CurrentSubscriptionView, PlanListView, SubscriptionUsageView


app_name = "subscriptions"

urlpatterns = [
    path("plans/", PlanListView.as_view(), name="plan-list"),
    path("subscription/", CurrentSubscriptionView.as_view(), name="subscription-detail"),
    path("subscription/usage/", SubscriptionUsageView.as_view(), name="subscription-usage"),
]
