from base64 import b64decode

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from surveys.models import Collector, EmailInvitation
from surveys.serializers import (
    CollectorSendEmailsSerializer,
    CollectorSendRemindersSerializer,
    CollectorSerializer,
    EmailInvitationSerializer,
)
from surveys.tasks import dispatch_task, send_reminder, send_survey_invitation, upsert_email_invitations

from .common import get_owned_survey

TRACKING_PIXEL_BYTES = b64decode("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=")


class CollectorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_survey(self):
        return get_owned_survey(self.request.user, self.kwargs["survey_pk"])

    def get_queryset(self):
        queryset = self.get_survey().collectors.all()

        if self.action == "invitations":
            queryset = queryset.prefetch_related("email_invitations")

        return queryset

    def get_serializer_class(self):
        if self.action == "invitations":
            return EmailInvitationSerializer
        if self.action == "send_emails":
            return CollectorSendEmailsSerializer
        if self.action == "send_reminders":
            return CollectorSendRemindersSerializer
        return CollectorSerializer

    def perform_create(self, serializer):
        serializer.save(survey=self.get_survey())

    def invitations(self, request, survey_pk=None, pk=None):
        collector = self.get_object()
        serializer = EmailInvitationSerializer(
            collector.email_invitations.all(),
            many=True,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def send_emails(self, request, survey_pk=None, pk=None):
        collector = self.get_object()
        if collector.type != Collector.CollectorType.EMAIL:
            return Response(
                {"detail": "Email invitations are only available for email collectors."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CollectorSendEmailsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        subject = serializer.validated_data.get("subject", "").strip()
        message = serializer.validated_data.get("message", "").strip()
        invitations = upsert_email_invitations(
            collector,
            serializer.validated_data["parsed_emails"],
        )

        collector.settings = {
            **(collector.settings or {}),
            "email_subject": subject,
            "email_message": message,
        }
        collector.save(update_fields=["settings"])

        queued_ids = []
        for invitation in invitations:
            if invitation.status == EmailInvitation.Status.COMPLETED:
                continue
            queued_ids.append(str(invitation.id))
            dispatch_task(
                send_survey_invitation,
                str(invitation.id),
                subject=subject,
                message=message,
                reminder=False,
            )

        invitation_serializer = EmailInvitationSerializer(invitations, many=True)
        return Response(
            {
                "queued": len(queued_ids),
                "invitations": invitation_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def send_reminders(self, request, survey_pk=None, pk=None):
        collector = self.get_object()
        if collector.type != Collector.CollectorType.EMAIL:
            return Response(
                {"detail": "Reminders are only available for email collectors."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CollectorSendRemindersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation_ids = serializer.validated_data.get("invitation_ids")
        eligible_queryset = collector.email_invitations.exclude(
            status=EmailInvitation.Status.COMPLETED
        )
        if invitation_ids:
            eligible_queryset = eligible_queryset.filter(id__in=invitation_ids)
        queued_count = eligible_queryset.count()

        dispatch_task(
            send_reminder,
            str(collector.id),
            invitation_ids=invitation_ids,
            subject=(collector.settings or {}).get("email_subject", ""),
            message=(collector.settings or {}).get("email_message", ""),
        )

        return Response(
            {
                "queued": queued_count,
                "detail": "Reminder emails have been queued.",
            },
            status=status.HTTP_200_OK,
        )


class EmailOpenTrackingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        invitation = EmailInvitation.objects.filter(token=token).first()
        if invitation and invitation.status != EmailInvitation.Status.COMPLETED:
            now = timezone.now()
            invitation.opened_at = invitation.opened_at or now
            invitation.sent_at = invitation.sent_at or now
            invitation.status = EmailInvitation.Status.OPENED
            invitation.save(update_fields=["status", "sent_at", "opened_at"])

        return HttpResponse(TRACKING_PIXEL_BYTES, content_type="image/gif")
