from django.contrib import admin

from surveys.models import (
    Answer,
    Choice,
    Collector,
    EmailInvitation,
    ExportJob,
    Page,
    Question,
    SavedReport,
    Survey,
    SurveyResponse,
)


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "status", "slug", "created_at", "updated_at")
    list_filter = ("status", "created_at", "updated_at")
    search_fields = ("title", "description", "slug", "user__username", "user__email")


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ("title", "survey", "order")
    list_filter = ("survey",)
    search_fields = ("title", "description", "survey__title")
    ordering = ("survey", "order")


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("text", "page", "question_type", "required", "order")
    list_filter = ("question_type", "required", "page__survey")
    search_fields = ("text", "description", "page__survey__title")
    ordering = ("page", "order")


@admin.register(Choice)
class ChoiceAdmin(admin.ModelAdmin):
    list_display = ("text", "question", "order", "is_other", "score")
    list_filter = ("is_other", "question__question_type")
    search_fields = ("text", "question__text")
    ordering = ("question", "order")


@admin.register(Collector)
class CollectorAdmin(admin.ModelAdmin):
    list_display = ("name", "survey", "type", "status", "created_at")
    list_filter = ("type", "status", "created_at")
    search_fields = ("name", "survey__title")


@admin.register(EmailInvitation)
class EmailInvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "collector", "status", "sent_at", "completed_at")
    list_filter = ("status",)
    search_fields = ("email", "collector__name", "collector__survey__title")


@admin.register(SurveyResponse)
class SurveyResponseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "survey",
        "status",
        "respondent_email",
        "started_at",
        "completed_at",
    )
    list_filter = ("status", "survey")
    search_fields = ("respondent_email", "resume_token", "survey__title")


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ("response", "question", "answered_at")
    list_filter = ("question__question_type",)
    search_fields = ("question__text", "response__respondent_email")


@admin.register(SavedReport)
class SavedReportAdmin(admin.ModelAdmin):
    list_display = ("name", "survey", "user", "is_shared", "updated_at")
    list_filter = ("is_shared", "updated_at")
    search_fields = ("name", "survey__title", "user__username")


@admin.register(ExportJob)
class ExportJobAdmin(admin.ModelAdmin):
    list_display = ("survey", "user", "format", "status", "created_at", "completed_at")
    list_filter = ("format", "status")
    search_fields = ("survey__title", "user__username")
