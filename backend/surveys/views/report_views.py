from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from surveys.models import SavedReport
from surveys.serializers import SavedReportSerializer
from surveys.services import (
    AIServiceConfigurationError,
    AIServiceRequestError,
    AnalyticsService,
    SharedReportAccessError,
    build_saved_report_payload,
    get_shared_report,
    normalize_saved_report_config,
)

from .common import get_owned_survey


class SavedReportViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SavedReportSerializer
    pagination_class = None

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_queryset(self):
        return SavedReport.objects.filter(
            survey=self.get_survey(),
            user=self.request.user,
        ).order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(
            survey=self.get_survey(),
            user=self.request.user,
        )


class PublicSavedReportDataView(APIView):
    permission_classes = [AllowAny]

    def _authorize_report(self, request, report_pk, *, password=""):
        session_key = f"shared_report_access:{report_pk}"
        session_authorized = bool(request.session.get(session_key))

        try:
            report = get_shared_report(
                report_pk,
                password=password,
                session_authorized=session_authorized,
            )
        except SharedReportAccessError as exc:
            return Response(
                {
                    "detail": exc.detail,
                    "code": exc.code,
                    "report": {
                        "id": str(exc.report.id),
                        "name": exc.report.name,
                        "has_share_password": exc.report.has_share_password(),
                    },
                    "survey": {
                        "title": exc.report.survey.title,
                        "description": exc.report.survey.description,
                    },
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if password and report.has_share_password():
            request.session[session_key] = True

        return report

    def _handle_request(self, request, report_pk, *, password=""):
        report = self._authorize_report(request, report_pk, password=password)
        if isinstance(report, Response):
            return report

        payload = build_saved_report_payload(report, include_insights=False)
        return Response(payload, status=status.HTTP_200_OK)

    def get(self, request, report_pk):
        return self._handle_request(request, report_pk)

    def post(self, request, report_pk):
        password = (request.data.get("password") or "").strip()
        return self._handle_request(request, report_pk, password=password)


class PublicSavedReportQuestionInsightsView(PublicSavedReportDataView):
    permission_classes = [AllowAny]

    def post(self, request, report_pk, question_pk):
        password = (request.data.get("password") or "").strip()
        report = self._authorize_report(request, report_pk, password=password)
        if isinstance(report, Response):
            return report

        config = normalize_saved_report_config(report.config)
        service = AnalyticsService(
            report.survey,
            raw_filters=config["filters"],
            include_insights=False,
        )

        try:
            data = service.get_question_ai_insights(question_pk)
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
