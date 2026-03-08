from django.urls import include, path
from rest_framework.routers import DefaultRouter

from surveys.views import (
    CollectorViewSet,
    EmailOpenTrackingView,
    ExportJobViewSet,
    PageViewSet,
    PublicSurveyView,
    PublicSavedReportDataView,
    QuestionViewSet,
    SavedReportViewSet,
    SurveyAnalyticsCrossTabView,
    SurveyAnalyticsQuestionDetailView,
    SurveyAnalyticsQuestionListView,
    SurveyAnalyticsSummaryView,
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
        "surveys/<uuid:survey_pk>/responses/bulk-delete/",
        SurveyResponseViewSet.as_view({"post": "bulk_delete"}),
        name="response-bulk-delete",
    ),
    path(
        "surveys/<uuid:survey_pk>/responses/<uuid:pk>/",
        SurveyResponseViewSet.as_view({"get": "retrieve", "delete": "destroy"}),
        name="response-detail",
    ),
    path(
        "surveys/<uuid:survey_pk>/analytics/summary/",
        SurveyAnalyticsSummaryView.as_view(),
        name="analytics-summary",
    ),
    path(
        "surveys/<uuid:survey_pk>/analytics/questions/",
        SurveyAnalyticsQuestionListView.as_view(),
        name="analytics-question-list",
    ),
    path(
        "surveys/<uuid:survey_pk>/analytics/questions/<uuid:question_pk>/",
        SurveyAnalyticsQuestionDetailView.as_view(),
        name="analytics-question-detail",
    ),
    path(
        "surveys/<uuid:survey_pk>/analytics/crosstab/",
        SurveyAnalyticsCrossTabView.as_view(),
        name="analytics-crosstab",
    ),
    path(
        "surveys/<uuid:survey_pk>/reports/",
        SavedReportViewSet.as_view({"get": "list", "post": "create"}),
        name="saved-report-list",
    ),
    path(
        "surveys/<uuid:survey_pk>/reports/<uuid:pk>/",
        SavedReportViewSet.as_view(
            {
                "get": "retrieve",
                "patch": "partial_update",
                "put": "update",
                "delete": "destroy",
            }
        ),
        name="saved-report-detail",
    ),
    path(
        "surveys/<uuid:survey_pk>/exports/",
        ExportJobViewSet.as_view({"post": "create"}),
        name="export-job-list",
    ),
    path(
        "surveys/<uuid:survey_pk>/exports/<uuid:pk>/",
        ExportJobViewSet.as_view({"get": "retrieve"}),
        name="export-job-detail",
    ),
    path(
        "reports/<uuid:report_pk>/data/",
        PublicSavedReportDataView.as_view(),
        name="public-report-data",
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
