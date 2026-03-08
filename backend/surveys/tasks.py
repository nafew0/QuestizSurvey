from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

from surveys.models import Collector, EmailInvitation, ExportJob
from surveys.services.exports import (
    PDFExportService,
    PPTXExportService,
    XLSXExportService,
    build_export_context,
    save_export_file,
)


def get_public_app_url():
    return getattr(settings, "PUBLIC_APP_URL", "http://localhost:5555").rstrip("/")


def get_api_base_url():
    return getattr(settings, "API_BASE_URL", "http://localhost:8000/api").rstrip("/")


def dispatch_task(task, *args, **kwargs):
    if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
        return task.apply(args=args, kwargs=kwargs)
    return task.delay(*args, **kwargs)


def dispatch_export_job(export_job):
    if export_job.format == ExportJob.ExportFormat.PDF:
        return dispatch_task(generate_pdf_report, str(export_job.id))
    if export_job.format == ExportJob.ExportFormat.XLSX:
        return dispatch_task(generate_xlsx_report, str(export_job.id))
    if export_job.format == ExportJob.ExportFormat.PPTX:
        return dispatch_task(generate_pptx_report, str(export_job.id))
    raise ValueError(f"Unsupported export format: {export_job.format}")


def upsert_email_invitations(collector, emails):
    invitations = []

    for email in emails:
        invitation, _ = EmailInvitation.objects.get_or_create(
            collector=collector,
            email=email,
        )
        invitations.append(invitation)

    return invitations


def build_email_subject(invitation, subject="", reminder=False):
    survey = invitation.collector.survey
    base_subject = (
        subject.strip()
        or invitation.collector.settings.get("email_subject", "").strip()
        or f"You are invited to {survey.title}"
    )

    if reminder and not base_subject.lower().startswith("reminder:"):
        return f"Reminder: {base_subject}"

    return base_subject


def deliver_invitation_email(invitation, *, subject="", message="", reminder=False):
    survey = invitation.collector.survey
    custom_message = (
        message
        if message.strip()
        else invitation.collector.settings.get("email_message", "").strip()
    )
    subject_line = build_email_subject(invitation, subject, reminder)
    survey_url = f"{get_public_app_url()}/s/{survey.slug}?invite={invitation.token}"
    tracking_pixel_url = f"{get_api_base_url()}/track/open/{invitation.token}/"

    context = {
        "survey": survey,
        "collector": invitation.collector,
        "invitation": invitation,
        "survey_url": survey_url,
        "tracking_pixel_url": tracking_pixel_url,
        "custom_message": custom_message,
        "subject": subject_line,
        "is_reminder": reminder,
    }
    html_message = render_to_string("emails/invitation.html", context)
    plain_message = strip_tags(html_message)

    send_mail(
        subject=subject_line,
        message=plain_message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@questiz.local"),
        recipient_list=[invitation.email],
        html_message=html_message,
        fail_silently=False,
    )

    invitation.sent_at = invitation.sent_at or timezone.now()
    if invitation.status != EmailInvitation.Status.COMPLETED:
        invitation.status = (
            EmailInvitation.Status.OPENED
            if invitation.opened_at
            else EmailInvitation.Status.SENT
        )
    invitation.save(update_fields=["status", "sent_at"])
    return invitation


@shared_task
def send_survey_invitation(invitation_id, subject="", message="", reminder=False):
    invitation = EmailInvitation.objects.select_related(
        "collector__survey"
    ).get(id=invitation_id)
    deliver_invitation_email(
        invitation,
        subject=subject,
        message=message,
        reminder=reminder,
    )
    return str(invitation.id)


@shared_task
def send_bulk_invitations(collector_id, emails, subject="", message=""):
    collector = Collector.objects.select_related("survey").get(id=collector_id)
    invitations = upsert_email_invitations(collector, emails)

    for invitation in invitations:
        if invitation.status == EmailInvitation.Status.COMPLETED:
            continue
        dispatch_task(
            send_survey_invitation,
            str(invitation.id),
            subject=subject,
            message=message,
            reminder=False,
        )

    return [str(invitation.id) for invitation in invitations]


@shared_task
def send_reminder(collector_id, invitation_ids=None, subject="", message=""):
    collector = Collector.objects.select_related("survey").get(id=collector_id)
    queryset = collector.email_invitations.exclude(
        status=EmailInvitation.Status.COMPLETED
    )

    if invitation_ids:
        queryset = queryset.filter(id__in=invitation_ids)

    reminder_ids = []
    for invitation in queryset:
        reminder_ids.append(str(invitation.id))
        dispatch_task(
            send_survey_invitation,
            str(invitation.id),
            subject=subject,
            message=message,
            reminder=True,
        )

    return reminder_ids


def _run_export(export_job_id, service, extension):
    export_job = ExportJob.objects.select_related("survey", "user").get(id=export_job_id)
    export_job.status = ExportJob.Status.PROCESSING
    export_job.error_message = ""
    export_job.save(update_fields=["status", "error_message"])

    try:
        analytics_data = build_export_context(export_job)
        content = service.generate(export_job.survey, analytics_data, export_job.config or {})
        export_job.file_url = save_export_file(export_job, content, extension)
        export_job.status = ExportJob.Status.COMPLETED
        export_job.completed_at = timezone.now()
        export_job.error_message = ""
        export_job.save(
            update_fields=["file_url", "status", "completed_at", "error_message"]
        )
        return export_job.file_url
    except Exception as exc:
        export_job.status = ExportJob.Status.FAILED
        export_job.error_message = str(exc)
        export_job.completed_at = timezone.now()
        export_job.save(
            update_fields=["status", "error_message", "completed_at"]
        )
        raise


@shared_task
def generate_pdf_report(export_job_id):
    return _run_export(export_job_id, PDFExportService(), "pdf")


@shared_task
def generate_xlsx_report(export_job_id):
    return _run_export(export_job_id, XLSXExportService(), "xlsx")


@shared_task
def generate_pptx_report(export_job_id):
    return _run_export(export_job_id, PPTXExportService(), "pptx")
