from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from surveys.serializers import CollectorSerializer

from .common import get_owned_survey


class CollectorViewSet(viewsets.ModelViewSet):
    serializer_class = CollectorSerializer
    permission_classes = [IsAuthenticated]

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_queryset(self):
        return self.get_survey().collectors.all()

    def perform_create(self, serializer):
        serializer.save(survey=self.get_survey())
