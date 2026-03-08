from __future__ import annotations

from collections import OrderedDict
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings
from django.utils import timezone

from surveys.models import Answer, ExportJob, Question, SavedReport, Survey, SurveyResponse
from surveys.serializers.response_serializers import build_answer_summary
from surveys.services.analytics import AnalyticsService
from surveys.services.filters import ResponseFilterService


STRUCTURAL_TYPES = {
    Question.QuestionType.SECTION_HEADING,
    Question.QuestionType.INSTRUCTIONAL_TEXT,
}


def get_backend_origin():
    api_base = getattr(settings, "API_BASE_URL", "http://localhost:8000/api").rstrip("/")
    parsed = urlparse(api_base)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return api_base.rsplit("/api", 1)[0]


def build_export_file_url(relative_path: str):
    media_root = getattr(settings, "MEDIA_URL", "/media/").strip("/")
    return f"{get_backend_origin()}/{media_root}/{relative_path.lstrip('/')}"


def save_export_file(export_job: ExportJob, content: bytes, extension: str):
    relative_path = Path("exports") / str(export_job.survey_id) / f"{export_job.id}.{extension}"
    absolute_path = Path(settings.MEDIA_ROOT) / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    absolute_path.write_bytes(content)
    return build_export_file_url(relative_path.as_posix())


def resolve_export_survey(export_job: ExportJob):
    return (
        Survey.objects.filter(id=export_job.survey_id)
        .prefetch_related("pages__questions__choices")
        .get()
    )


def resolve_export_config(export_job: ExportJob):
    config = dict(export_job.config or {})
    report_id = config.get("report_id")
    if report_id:
        report = SavedReport.objects.filter(
            id=report_id,
            survey_id=export_job.survey_id,
            user_id=export_job.user_id,
        ).first()
        if report:
            merged = dict(report.config or {})
            merged.update(config)
            config = merged

    if not config.get("chart_types") and config.get("card_preferences"):
        config["chart_types"] = {
            question_id: preference.get("chartType") or preference.get("chart_type")
            for question_id, preference in (config.get("card_preferences") or {}).items()
            if isinstance(preference, dict)
            and (preference.get("chartType") or preference.get("chart_type"))
        }

    if not config.get("include_cross_tabs"):
        cross_tab = config.get("cross_tab") or {}
        if cross_tab.get("row") and cross_tab.get("col"):
            config["include_cross_tabs"] = [
                {
                    "row_question_id": cross_tab["row"],
                    "col_question_id": cross_tab["col"],
                }
            ]
        elif config.get("cross_tabs"):
            config["include_cross_tabs"] = config["cross_tabs"]

    config.setdefault("filters", {})
    config.setdefault("chart_types", {})
    config.setdefault("include_cross_tabs", [])
    config.setdefault("branding", {})
    return config


def resolve_branding(survey: Survey, config):
    theme = dict(survey.theme or {})
    branding = dict(config.get("branding") or {})
    return {
        "company_name": branding.get("company_name") or "",
        "color": branding.get("color")
        or theme.get("primary_color")
        or "#2563eb",
        "logo_url": branding.get("logo_url") or theme.get("logo_url") or "",
    }


def resolve_export_questions(survey: Survey, config):
    all_questions = [
        question
        for page in survey.pages.all()
        for question in page.questions.all()
        if question.question_type not in STRUCTURAL_TYPES
    ]
    selected_ids = config.get("question_ids")
    if not selected_ids:
        return all_questions

    selected_set = {str(question_id) for question_id in selected_ids}
    return [question for question in all_questions if str(question.id) in selected_set]


def describe_filters(filters):
    descriptions = []

    if filters.get("date_from") or filters.get("date_to"):
        descriptions.append(
            {
                "label": "Date range",
                "value": f"{filters.get('date_from') or 'Any'} to {filters.get('date_to') or 'Any'}",
            }
        )
    if filters.get("status"):
        descriptions.append(
            {
                "label": "Status",
                "value": str(filters["status"]).replace("_", " ").title(),
            }
        )
    if filters.get("collector_id"):
        descriptions.append(
            {
                "label": "Collector",
                "value": str(filters["collector_id"]),
            }
        )
    if filters.get("text_search"):
        descriptions.append(
            {
                "label": "Search",
                "value": str(filters["text_search"]),
            }
        )
    if filters.get("duration_min_seconds") or filters.get("duration_max_seconds"):
        descriptions.append(
            {
                "label": "Duration",
                "value": f"{filters.get('duration_min_seconds') or 0}s to {filters.get('duration_max_seconds') or '∞'}s",
            }
        )

    for answer_filter in filters.get("answer_filters") or []:
        question_id = answer_filter.get("question_id") or "Question"
        descriptions.append(
            {
                "label": "Answer filter",
                "value": f"{question_id}: {answer_filter.get('choice_id') or answer_filter.get('text_value') or answer_filter.get('contains') or answer_filter.get('numeric_value') or 'match'}",
            }
        )

    return descriptions


def _get_choice_map(question):
    return {str(choice.id): choice.text for choice in question.choices.all()}


def format_answer_for_export(answer: Answer):
    question = answer.question
    choice_map = _get_choice_map(question)

    if answer.choice_ids:
        values = [choice_map.get(str(choice_id), str(choice_id)) for choice_id in answer.choice_ids]
        if answer.other_text:
            values.append(f"Other: {answer.other_text}")
        if answer.comment_text:
            values.append(f"Comment: {answer.comment_text}")
        return ", ".join(values)

    if answer.text_value:
        return answer.text_value

    if answer.numeric_value is not None:
        return str(answer.numeric_value)

    if answer.date_value:
        return answer.date_value.isoformat()

    if answer.file_url:
        return answer.file_url

    if answer.ranking_data:
        return " > ".join(
            choice_map.get(str(choice_id), str(choice_id))
            for choice_id in answer.ranking_data
        )

    if answer.constant_sum_data:
        allocations = []
        for choice_id, value in (answer.constant_sum_data or {}).items():
            allocations.append(f"{choice_map.get(str(choice_id), str(choice_id))}: {value}")
        return "; ".join(allocations)

    if answer.matrix_data:
        fragments = []
        for key, value in (answer.matrix_data or {}).items():
            if isinstance(value, dict):
                selected = [label for label, checked in value.items() if checked]
                fragments.append(f"{key}: {', '.join(selected)}")
            else:
                fragments.append(f"{key}: {value}")
        return "; ".join(fragment for fragment in fragments if fragment)

    return ""


def build_raw_response_rows(survey: Survey, questions, filters):
    responses = (
        ResponseFilterService(
            survey.responses.select_related("collector", "current_page").prefetch_related(
                "answers__question__choices"
            ),
            filters,
        )
        .apply()
        .order_by("-started_at")
    )

    rows = []
    for response in responses:
        answer_lookup = {
            str(answer.question_id): format_answer_for_export(answer)
            for answer in response.answers.all()
        }
        summary_lookup = {
            str(answer.question_id): build_answer_summary(answer)
            for answer in response.answers.all()
        }

        flat_values = OrderedDict()
        for question in questions:
            flat_values[str(question.id)] = answer_lookup.get(
                str(question.id),
                summary_lookup.get(str(question.id), ""),
            )

        rows.append(
            {
                "id": str(response.id),
                "status": response.status,
                "started_at": response.started_at,
                "completed_at": response.completed_at,
                "duration_seconds": response.duration_seconds,
                "collector_name": response.collector.name if response.collector else "",
                "respondent_email": response.respondent_email or "",
                "ip_address": response.ip_address or "",
                "values": flat_values,
            }
        )

    return rows


def _categorical_section(analytics):
    rows = [
        {
            "label": choice["text"],
            "count": choice["count"],
            "percentage": choice["percentage"],
        }
        for choice in analytics.get("choices", [])
    ]
    top_row = max(rows, key=lambda item: item["count"], default=None)
    return {
        "table_columns": ["Option", "Count", "Percentage"],
        "table_rows": rows,
        "highlights": [
            {"label": "Responses", "value": analytics.get("total_responses", 0)},
            {
                "label": "Top answer",
                "value": f"{top_row['label']} ({top_row['percentage']}%)" if top_row else "—",
            },
        ],
    }


def _numeric_section(analytics):
    rows = [
        {
            "label": str(item["value"]),
            "count": item["count"],
            "percentage": item["percentage"],
        }
        for item in analytics.get("distribution", [])
    ]
    highlights = [
        {"label": "Responses", "value": analytics.get("total_responses", 0)},
        {"label": "Mean", "value": analytics.get("mean") or "—"},
        {"label": "Median", "value": analytics.get("median") or "—"},
        {"label": "Range", "value": f"{analytics.get('min') or 0} - {analytics.get('max') or 0}"},
    ]
    if analytics.get("nps_score") is not None:
        highlights.append({"label": "NPS", "value": analytics.get("nps_score")})
    return {
        "table_columns": ["Value", "Count", "Percentage"],
        "table_rows": rows,
        "highlights": highlights,
    }


def _text_section(analytics):
    responses = [item["text"] for item in analytics.get("responses", [])[:10]]
    rows = [
        {"label": item["word"], "count": item["count"], "percentage": ""}
        for item in analytics.get("word_frequencies", [])[:15]
    ]
    return {
        "table_columns": ["Word", "Count", ""],
        "table_rows": rows,
        "highlights": [
            {"label": "Responses", "value": analytics.get("total_responses", 0)},
            {"label": "Avg words", "value": analytics.get("avg_word_count", 0)},
        ],
        "text_responses": responses,
    }


def _matrix_section(analytics):
    first_row = analytics.get("rows", [{}])[0]
    column_labels = [column["col_label"] for column in first_row.get("columns", [])]
    return {
        "table_columns": ["Row", *column_labels],
        "table_rows": [
            {
                "label": row["row_label"],
                "values": [column["count"] for column in row["columns"]],
            }
            for row in analytics.get("rows", [])
        ],
        "highlights": [
            {"label": "Responses", "value": analytics.get("total_responses", 0)},
        ],
        "row_averages": analytics.get("row_averages", []),
    }


def _ranking_section(analytics):
    rows = [
        {
            "label": item["text"],
            "count": item["avg_rank"] if item["avg_rank"] is not None else "—",
            "percentage": "",
        }
        for item in analytics.get("items", [])
    ]
    return {
        "table_columns": ["Choice", "Average rank", ""],
        "table_rows": rows,
        "highlights": [{"label": "Responses", "value": analytics.get("total_responses", 0)}],
    }


def _constant_sum_section(analytics):
    rows = [
        {
            "label": item["text"],
            "count": item["total_value"],
            "percentage": item["percentage"],
            "mean_value": item["mean_value"],
        }
        for item in analytics.get("items", [])
    ]
    return {
        "table_columns": ["Choice", "Total", "Percentage"],
        "table_rows": rows,
        "highlights": [{"label": "Responses", "value": analytics.get("total_responses", 0)}],
    }


def _temporal_section(analytics):
    rows = [
        {
            "label": item["date_bucket"],
            "count": item["count"],
            "percentage": "",
        }
        for item in analytics.get("distribution", [])
    ]
    return {
        "table_columns": ["Bucket", "Count", ""],
        "table_rows": rows,
        "highlights": [{"label": "Responses", "value": analytics.get("total_responses", 0)}],
    }


def _demographics_section(analytics):
    field_sections = []
    for field_name, values in (analytics.get("fields") or {}).items():
        field_sections.append(
            {
                "field_name": field_name,
                "rows": [
                    {
                        "label": item["value"],
                        "count": item["count"],
                        "percentage": item["percentage"],
                    }
                    for item in values
                ],
            }
        )
    return {
        "table_columns": ["Value", "Count", "Percentage"],
        "table_rows": [],
        "highlights": [{"label": "Responses", "value": analytics.get("total_responses", 0)}],
        "field_sections": field_sections,
    }


def _files_section(analytics):
    rows = [
        {
            "label": item["file_type"],
            "count": item["file_url"],
            "percentage": item["answered_at"],
        }
        for item in analytics.get("files", [])[:20]
    ]
    return {
        "table_columns": ["Type", "File URL", "Submitted"],
        "table_rows": rows,
        "highlights": [{"label": "Files", "value": analytics.get("total_responses", 0)}],
    }


def normalize_question_section(question: Question, analytics, config):
    analytics_type = analytics.get("type")
    section = {
        "id": str(question.id),
        "text": question.text,
        "question_type": question.question_type,
        "analytics_type": analytics_type,
        "chart_type": (config.get("chart_types") or {}).get(str(question.id)) or "bar",
        "total_responses": analytics.get("total_responses", 0),
        "raw": analytics,
        "table_columns": [],
        "table_rows": [],
        "highlights": [],
        "text_responses": [],
        "field_sections": [],
        "row_averages": [],
    }

    if analytics_type == "categorical":
        section.update(_categorical_section(analytics))
    elif analytics_type == "numeric":
        section.update(_numeric_section(analytics))
    elif analytics_type == "text":
        section.update(_text_section(analytics))
    elif analytics_type == "matrix":
        section.update(_matrix_section(analytics))
    elif analytics_type == "ranking":
        section.update(_ranking_section(analytics))
    elif analytics_type == "constant_sum":
        section.update(_constant_sum_section(analytics))
    elif analytics_type == "temporal":
        section.update(_temporal_section(analytics))
    elif analytics_type == "demographics":
        section.update(_demographics_section(analytics))
    elif analytics_type == "files":
        section.update(_files_section(analytics))

    return section


def normalize_cross_tab_section(analytics_service: AnalyticsService, cross_tab_entry):
    row_question_id = (
        cross_tab_entry.get("row_question_id")
        or cross_tab_entry.get("row_q_id")
        or cross_tab_entry.get("row")
    )
    col_question_id = (
        cross_tab_entry.get("col_question_id")
        or cross_tab_entry.get("col_q_id")
        or cross_tab_entry.get("col")
    )

    if not row_question_id or not col_question_id:
        return None

    data = analytics_service.get_cross_tabulation(row_question_id, col_question_id)
    return {
        "id": f"{row_question_id}:{col_question_id}",
        "title": f"{data['row_question']['text']} × {data['col_question']['text']}",
        "row_question": data["row_question"],
        "col_question": data["col_question"],
        "matrix": data["matrix"],
        "col_totals": data["col_totals"],
        "grand_total": data["grand_total"],
        "response_pairs": data["response_pairs"],
        "chi_square": data["chi_square"],
    }


def build_export_context(export_job: ExportJob):
    survey = resolve_export_survey(export_job)
    config = resolve_export_config(export_job)
    analytics_service = AnalyticsService(
        survey,
        raw_filters=config.get("filters") or {},
        include_insights=False,
    )
    questions = resolve_export_questions(survey, config)
    cross_tabs = [
        normalize_cross_tab_section(analytics_service, entry)
        for entry in config.get("include_cross_tabs") or []
    ]
    cross_tabs = [entry for entry in cross_tabs if entry]

    return {
        "survey": survey,
        "config": config,
        "branding": resolve_branding(survey, config),
        "generated_at": timezone.now(),
        "summary": analytics_service.get_summary(),
        "filters": config.get("filters") or {},
        "filter_descriptions": describe_filters(config.get("filters") or {}),
        "questions": [
            normalize_question_section(
                question,
                analytics_service.get_question_analytics(question.id, question=question),
                config,
            )
            for question in questions
        ],
        "cross_tabs": cross_tabs,
        "raw_questions": questions,
        "raw_responses": build_raw_response_rows(
            survey,
            questions,
            config.get("filters") or {},
        ),
    }
