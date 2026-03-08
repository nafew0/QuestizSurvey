from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from surveys.models import SavedReport
from surveys.serializers import SavedReportSerializer

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
