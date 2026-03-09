from __future__ import annotations

from dataclasses import dataclass

from django.shortcuts import get_object_or_404

from surveys.models import Collector, Question, SavedReport, Survey
from surveys.services.analytics import AnalyticsService
from surveys.theme import normalize_survey_theme


@dataclass
class SharedReportAccessError(Exception):
    code: str
    detail: str
    report: SavedReport


def normalize_saved_report_config(config=None):
    raw_config = dict(config or {})
    filters = dict(raw_config.get("filters") or {})
    question_ids = raw_config.get("question_ids")
    layout = raw_config.get("layout") or "summary"
    active_tab = raw_config.get("active_tab") or "overview"

    chart_overrides = dict(raw_config.get("chart_overrides") or {})
    card_preferences = dict(raw_config.get("card_preferences") or {})

    if not chart_overrides and card_preferences:
        chart_overrides = {
            question_id: {
                "chart_type": preference.get("chartType") or preference.get("chart_type"),
                "color_scheme": preference.get("colorScheme") or preference.get("color_scheme"),
                "show_table": preference.get("showTable", False),
                "show_labels": preference.get("showLabels", False),
            }
            for question_id, preference in card_preferences.items()
            if isinstance(preference, dict)
        }

    if not card_preferences and chart_overrides:
        card_preferences = {
            question_id: {
                "chartType": preference.get("chart_type") or preference.get("chartType"),
                "colorScheme": preference.get("color_scheme") or preference.get("colorScheme") or "default",
                "showTable": preference.get("show_table", preference.get("showTable", False)),
                "showLabels": preference.get("show_labels", preference.get("showLabels", False)),
            }
            for question_id, preference in chart_overrides.items()
            if isinstance(preference, dict)
        }

    cross_tabs = list(raw_config.get("cross_tabs") or [])
    cross_tab = dict(raw_config.get("cross_tab") or {})

    if not cross_tabs and cross_tab.get("row") and cross_tab.get("col"):
        cross_tabs = [
            {
                "row_question_id": cross_tab["row"],
                "col_question_id": cross_tab["col"],
                "view": cross_tab.get("view") or "table",
            }
        ]

    if not cross_tab and cross_tabs:
        first = cross_tabs[0]
        cross_tab = {
            "row": first.get("row_question_id") or first.get("row_q_id") or first.get("row") or "",
            "col": first.get("col_question_id") or first.get("col_q_id") or first.get("col") or "",
            "view": first.get("view") or "table",
        }

    return {
        "filters": filters,
        "question_ids": question_ids,
        "chart_overrides": chart_overrides,
        "card_preferences": card_preferences,
        "cross_tabs": cross_tabs,
        "cross_tab": cross_tab or {"row": "", "col": "", "view": "table"},
        "layout": layout,
        "active_tab": active_tab,
    }


def get_owner_report(user, survey_id, report_id):
    return get_object_or_404(
        SavedReport.objects.select_related("survey").filter(
            survey_id=survey_id,
            user=user,
        ),
        id=report_id,
    )


def get_shared_report(report_id, password="", session_authorized=False):
    report = get_object_or_404(
        SavedReport.objects.select_related("survey").prefetch_related(
            "survey__pages__questions__choices",
            "survey__collectors",
        ),
        id=report_id,
        is_shared=True,
    )

    if report.has_share_password() and not session_authorized:
        if not password:
            raise SharedReportAccessError(
                code="password_required",
                detail="This report is password protected.",
                report=report,
            )
        if not report.check_share_password(password):
            raise SharedReportAccessError(
                code="password_invalid",
                detail="The password for this report is incorrect.",
                report=report,
            )

    return report


def build_saved_report_payload(report: SavedReport, *, include_insights=True):
    survey = (
        Survey.objects.filter(id=report.survey_id)
        .prefetch_related("pages__questions__choices", "collectors")
        .get()
    )
    config = normalize_saved_report_config(report.config)
    analytics_service = AnalyticsService(
        survey,
        raw_filters=config["filters"],
        include_insights=include_insights,
    )

    question_queryset = [
        question
        for page in survey.pages.all()
        for question in page.questions.all()
        if question.question_type
        not in {
            Question.QuestionType.SECTION_HEADING,
            Question.QuestionType.INSTRUCTIONAL_TEXT,
        }
    ]
    if config["question_ids"]:
        selected_ids = {str(question_id) for question_id in config["question_ids"]}
        question_queryset = [
            question
            for question in question_queryset
            if str(question.id) in selected_ids
        ]

    cross_tabs = []
    for entry in config["cross_tabs"]:
        row_question_id = (
            entry.get("row_question_id") or entry.get("row_q_id") or entry.get("row")
        )
        col_question_id = (
            entry.get("col_question_id") or entry.get("col_q_id") or entry.get("col")
        )
        if not row_question_id or not col_question_id:
            continue
        cross_tab_data = analytics_service.get_cross_tabulation(
            row_question_id,
            col_question_id,
        )
        cross_tab_data["view"] = entry.get("view") or "table"
        cross_tabs.append(cross_tab_data)

    return {
        "report": {
            "id": str(report.id),
            "name": report.name,
            "is_shared": report.is_shared,
            "has_share_password": report.has_share_password(),
            "config": config,
        },
        "survey": {
            "id": str(survey.id),
            "title": survey.title,
            "description": survey.description,
            "slug": survey.slug,
            "status": survey.status,
            "theme": normalize_survey_theme(survey.theme),
        },
        "summary": analytics_service.get_summary(),
        "questions": [
            analytics_service.get_question_analytics(question.id, question=question)
            for question in question_queryset
        ],
        "cross_tabs": cross_tabs,
        "filters": config["filters"],
        "question_lookup": {
            str(question.id): question.text
            for page in survey.pages.all()
            for question in page.questions.all()
        },
        "collector_lookup": {
            str(collector.id): collector.name
            for collector in survey.collectors.all()
        },
    }
