from django.urls import include, path
from rest_framework.routers import DefaultRouter

from surveys.views import (
    CollectorViewSet,
    EmailOpenTrackingView,
    PageViewSet,
    PublicSurveyView,
    QuestionViewSet,
    SurveyResponseViewSet,
    SurveyViewSet,
)

app_name = "surveys"

router = DefaultRouter()
router.register("surveys", SurveyViewSet, basename="survey")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "surveys/<uuid:survey_pk>/pages/",
        PageViewSet.as_view({"get": "list", "post": "create"}),
        name="page-list",
    ),
    path(
        "surveys/<uuid:survey_pk>/pages/reorder/",
        PageViewSet.as_view({"patch": "reorder"}),
        name="page-reorder",
    ),
    path(
        "surveys/<uuid:survey_pk>/pages/<uuid:pk>/",
        PageViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="page-detail",
    ),
    path(
        "surveys/<uuid:survey_pk>/pages/<uuid:page_pk>/questions/",
        QuestionViewSet.as_view({"get": "list", "post": "create"}),
        name="question-list",
    ),
    path(
        "surveys/<uuid:survey_pk>/pages/<uuid:page_pk>/questions/reorder/",
        QuestionViewSet.as_view({"patch": "reorder"}),
        name="question-reorder",
    ),
    path(
        "surveys/<uuid:survey_pk>/pages/<uuid:page_pk>/questions/<uuid:pk>/",
        QuestionViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="question-detail",
    ),
    path(
        "surveys/<uuid:survey_pk>/collectors/",
        CollectorViewSet.as_view({"get": "list", "post": "create"}),
        name="collector-list",
    ),
    path(
        "surveys/<uuid:survey_pk>/collectors/<uuid:pk>/",
        CollectorViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="collector-detail",
    ),
    path(
        "surveys/<uuid:survey_pk>/collectors/<uuid:pk>/invitations/",
        CollectorViewSet.as_view({"get": "invitations"}),
        name="collector-invitations",
    ),
    path(
        "surveys/<uuid:survey_pk>/collectors/<uuid:pk>/send-emails/",
        CollectorViewSet.as_view({"post": "send_emails"}),
        name="collector-send-emails",
    ),
    path(
        "surveys/<uuid:survey_pk>/collectors/<uuid:pk>/send-reminders/",
        CollectorViewSet.as_view({"post": "send_reminders"}),
        name="collector-send-reminders",
    ),
    path(
        "surveys/<uuid:survey_pk>/responses/",
        SurveyResponseViewSet.as_view({"get": "list"}),
        name="response-list",
    ),
    path(
        "surveys/<uuid:survey_pk>/responses/<uuid:pk>/",
        SurveyResponseViewSet.as_view({"get": "retrieve"}),
        name="response-detail",
    ),
    path(
        "public/surveys/<slug:slug>/", PublicSurveyView.as_view(), name="public-survey"
    ),
    path(
        "track/open/<str:token>/",
        EmailOpenTrackingView.as_view(),
        name="track-open",
    ),
]
