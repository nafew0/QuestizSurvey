from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from surveys.models import ExportJob
from surveys.serializers import ExportJobCreateSerializer, ExportJobSerializer
from surveys.tasks import (
    dispatch_export_job,
)

from .common import get_owned_survey


class ExportJobViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_queryset(self):
        return ExportJob.objects.filter(
            survey=self.get_survey(),
            user=self.request.user,
        ).order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return ExportJobCreateSerializer
        return ExportJobSerializer

    def create(self, request, *args, **kwargs):
        survey = self.get_survey()
        serializer = self.get_serializer(
            data=request.data,
            context={
                "request": request,
                "survey": survey,
            },
        )
        serializer.is_valid(raise_exception=True)

        export_job = ExportJob.objects.create(
            survey=survey,
            user=request.user,
            format=serializer.validated_data["format"],
            config=serializer.validated_data.get("config") or {},
        )
        dispatch_export_job(export_job)
        export_job.refresh_from_db()

        response_serializer = ExportJobSerializer(export_job)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
