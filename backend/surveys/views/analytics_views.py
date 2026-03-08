from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from surveys.services import AnalyticsService

from .common import get_owned_survey


class SurveyAnalyticsBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_service(self):
        include_insights = self.request.query_params.get("include_insights") == "true"
        return AnalyticsService(
            self.get_survey(),
            raw_filters=self.request.query_params,
            include_insights=include_insights,
        )


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
