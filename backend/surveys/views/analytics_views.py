from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from surveys.services import (
    AIServiceConfigurationError,
    AIServiceRequestError,
    AnalyticsService,
)

from .common import get_owned_survey


class SurveyAnalyticsBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_service(self, *, raw_filters=None):
        include_insights = self.request.query_params.get("include_insights") == "true"
        return AnalyticsService(
            self.get_survey(),
            raw_filters=self.request.query_params if raw_filters is None else raw_filters,
            include_insights=include_insights,
        )


class QuestionInsightsThrottle(SimpleRateThrottle):
    scope = "question_insights"
    rate = "10/min"

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }


class QuestionInsightsRequestSerializer(serializers.Serializer):
    filters = serializers.JSONField(required=False)

    def validate_filters(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Filters must be an object.")
        return value


class SurveyAnalyticsSummaryView(SurveyAnalyticsBaseView):
    def get(self, request, survey_pk):
        data = self.get_service().get_summary()
        return Response(data)


class SurveyAnalyticsQuestionListView(SurveyAnalyticsBaseView):
    def get(self, request, survey_pk):
        data = self.get_service().get_all_question_analytics()
        return Response(data)


class SurveyAnalyticsQuestionDetailView(SurveyAnalyticsBaseView):
    def get(self, request, survey_pk, question_pk):
        data = self.get_service().get_question_analytics(question_pk)
        return Response(data)


class SurveyAnalyticsQuestionInsightsView(SurveyAnalyticsBaseView):
    throttle_classes = [QuestionInsightsThrottle]

    def post(self, request, survey_pk, question_pk):
        serializer = QuestionInsightsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            data = self.get_service(
                raw_filters=serializer.validated_data.get("filters", {})
            ).get_question_ai_insights(question_pk)
        except AIServiceConfigurationError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AIServiceRequestError as exc:
            detail = str(exc)
            response_status = (
                status.HTTP_400_BAD_REQUEST
                if "No responses are available" in detail
                or "No usable responses are available" in detail
                else status.HTTP_502_BAD_GATEWAY
            )
            return Response({"detail": detail}, status=response_status)

        return Response(data, status=status.HTTP_200_OK)


class SurveyAnalyticsCrossTabView(SurveyAnalyticsBaseView):
    def get(self, request, survey_pk):
        row_question_id = request.query_params.get("row")
        col_question_id = request.query_params.get("col")

        if not row_question_id or not col_question_id:
            return Response(
                {"detail": "Both row and col query parameters are required."},
                status=400,
            )

        data = self.get_service().get_cross_tabulation(
            row_question_id,
            col_question_id,
        )
        return Response(data)
