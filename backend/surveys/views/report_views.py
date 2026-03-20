from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from surveys.models import SavedReport
from surveys.serializers import SavedReportSerializer
from surveys.services import (
    SharedReportAccessError,
    build_saved_report_payload,
    get_shared_report,
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

    def _handle_request(self, request, report_pk, *, password=""):
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

        payload = build_saved_report_payload(report, include_insights=True)
        return Response(payload, status=status.HTTP_200_OK)

    def get(self, request, report_pk):
        return self._handle_request(request, report_pk)

    def post(self, request, report_pk):
        password = (request.data.get("password") or "").strip()
        return self._handle_request(request, report_pk, password=password)
