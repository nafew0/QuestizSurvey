import copy
import secrets
import uuid
from collections import OrderedDict

from django.db.models import Prefetch
from django.utils import timezone

from surveys.answer_formatting import format_matrix_answer
from surveys.models import Answer, Question, SurveyResponse

DEFAULT_PRIZE_SLOTS = [
    "First prize",
    "Second prize",
    "Third prize",
]

DEMOGRAPHIC_FIELD_LABELS = OrderedDict(
    [
        ("name", "Full name"),
        ("email", "Email address"),
        ("phone", "Phone number"),
        ("address", "Street address"),
        ("city", "City"),
        ("state", "State"),
        ("zip", "ZIP code"),
        ("country", "Country"),
    ]
)


def _unique_preserve_order(values):
    seen = set()
    unique_values = []

    for value in values:
        normalized = str(value or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique_values.append(normalized)

    return unique_values


def normalize_lottery_settings(settings):
    raw_lottery = copy.deepcopy((settings or {}).get("lottery") or {})
    prize_slots = _unique_preserve_order(raw_lottery.get("prize_slots") or [])
    history = []

    for draw in raw_lottery.get("history") or []:
        response_id = str(draw.get("response_id") or "").strip()
        draw_id = str(draw.get("id") or "").strip()
        prize_label = str(draw.get("prize_label") or "").strip()

        if not response_id or not draw_id or not prize_label:
            continue

        selected_values = []
        for value in draw.get("selected_values") or []:
            field_id = str(value.get("field_id") or "").strip()
            label = str(value.get("label") or "").strip()
            answer_value = str(value.get("value") or "").strip()
            if not field_id or not answer_value:
                continue
            selected_values.append(
                {
                    "field_id": field_id,
                    "label": label,
                    "value": answer_value,
                }
            )

        history.append(
            {
                "id": draw_id,
                "prize_label": prize_label,
                "response_id": response_id,
                "entry_label": str(draw.get("entry_label") or "").strip(),
                "selected_values": selected_values,
                "drawn_at": str(draw.get("drawn_at") or "").strip(),
            }
        )

    return {
        "enabled": bool(raw_lottery.get("enabled", True)),
        "selected_fields": _unique_preserve_order(raw_lottery.get("selected_fields") or []),
        "prize_slots": prize_slots or DEFAULT_PRIZE_SLOTS[:],
        "exclude_previous_winners": bool(raw_lottery.get("exclude_previous_winners", True)),
        "history": history,
    }


def set_lottery_settings(survey, lottery_settings):
    next_settings = dict(survey.settings or {})
    next_settings["lottery"] = normalize_lottery_settings({"lottery": lottery_settings})
    survey.settings = next_settings
    survey.save(update_fields=["settings", "updated_at"])
    return next_settings["lottery"]


def build_lottery_field_catalog(survey):
    fields = [
        {
            "id": "response:email",
            "label": "Respondent email",
            "source_type": "response",
            "question_id": None,
            "question_type": None,
            "page_id": None,
            "page_title": "Response",
        }
    ]

    for page in survey.pages.all():
        for question in page.questions.all():
            if question.question_type in {
                Question.QuestionType.SECTION_HEADING,
                Question.QuestionType.INSTRUCTIONAL_TEXT,
                Question.QuestionType.FILE_UPLOAD,
            }:
                continue

            if question.question_type == Question.QuestionType.DEMOGRAPHICS:
                configured_fields = question.settings.get("fields", {})
                enabled_fields = []
                if isinstance(configured_fields, list):
                    enabled_fields = [
                        field
                        for field in DEMOGRAPHIC_FIELD_LABELS
                        if field in configured_fields
                    ]
                else:
                    enabled_fields = [
                        field
                        for field in DEMOGRAPHIC_FIELD_LABELS
                        if configured_fields.get(field)
                    ]

                for field in enabled_fields:
                    fields.append(
                        {
                            "id": f"question:{question.id}:field:{field}",
                            "label": f"{question.text} - {DEMOGRAPHIC_FIELD_LABELS[field]}",
                            "source_type": "demographic",
                            "question_id": str(question.id),
                            "question_type": question.question_type,
                            "page_id": str(page.id),
                            "page_title": page.title,
                        }
                    )
                continue

            fields.append(
                {
                    "id": f"question:{question.id}",
                    "label": question.text,
                    "source_type": "question",
                    "question_id": str(question.id),
                    "question_type": question.question_type,
                    "page_id": str(page.id),
                    "page_title": page.title,
                }
            )

    return fields


def _build_choice_map(question):
    return {
        str(choice.id): choice.text
        for choice in question.choices.all()
    }


def _build_answer_display_value(answer):
    question = answer.question
    choice_map = _build_choice_map(question)

    if answer.choice_ids:
        labels = [choice_map.get(str(choice_id), str(choice_id)) for choice_id in answer.choice_ids]
        if answer.other_text.strip():
            labels.append(answer.other_text.strip())
        return ", ".join(filter(None, labels))

    if answer.text_value.strip():
        return answer.text_value.strip()

    if answer.numeric_value is not None:
        return str(answer.numeric_value)

    if answer.date_value:
        return answer.date_value.isoformat()

    if answer.ranking_data:
        return " > ".join(
            choice_map.get(str(choice_id), str(choice_id))
            for choice_id in answer.ranking_data
        )

    if answer.constant_sum_data:
        return ", ".join(
            f"{choice_map.get(str(choice_id), str(choice_id))}: {value}"
            for choice_id, value in answer.constant_sum_data.items()
        )

    if answer.matrix_data:
        return format_matrix_answer(question, answer.matrix_data, separator=", ")

    if answer.file_url:
        return answer.file_url

    if answer.other_text.strip():
        return answer.other_text.strip()

    return ""


def _extract_field_value(field_id, response, answer_lookup):
    if field_id == "response:email":
        invitation = getattr(response, "email_invitation", None)
        return (
            (response.respondent_email or "").strip()
            or (invitation.email if invitation else "").strip()
        )

    if field_id.startswith("question:") and ":field:" in field_id:
        _, question_id, _, field_name = field_id.split(":", 3)
        answer = answer_lookup.get(question_id)
        if not answer or not isinstance(answer.matrix_data, dict):
            return ""
        return str(answer.matrix_data.get(field_name) or "").strip()

    if field_id.startswith("question:"):
        question_id = field_id.split(":", 1)[1]
        answer = answer_lookup.get(question_id)
        if not answer:
            return ""
        return _build_answer_display_value(answer)

    return ""


def build_lottery_entries(survey, selected_fields, exclude_response_ids=None):
    if not selected_fields:
        return []

    field_catalog = build_lottery_field_catalog(survey)
    field_lookup = {field["id"]: field for field in field_catalog}
    valid_selected_fields = [
        field_id for field_id in selected_fields if field_id in field_lookup
    ]
    if not valid_selected_fields:
        return []

    responses = (
        survey.responses.filter(status=SurveyResponse.Status.COMPLETED)
        .exclude(id__in=list(exclude_response_ids or []))
        .select_related("email_invitation")
        .prefetch_related(
            Prefetch(
                "answers",
                queryset=Answer.objects.select_related("question", "question__page")
                .prefetch_related("question__choices")
                .order_by("question__page__order", "question__order"),
            )
        )
        .order_by("-completed_at", "-started_at")
    )

    entries = []

    for index, response in enumerate(responses, start=1):
        answer_lookup = {
            str(answer.question_id): answer
            for answer in response.answers.all()
        }
        selected_values = []

        for field_id in valid_selected_fields:
            value = _extract_field_value(field_id, response, answer_lookup)
            if not value:
                continue
            selected_values.append(
                {
                    "field_id": field_id,
                    "label": field_lookup[field_id]["label"],
                    "value": value,
                }
            )

        if not selected_values:
            continue

        label = " • ".join(value["value"] for value in selected_values)
        entries.append(
            {
                "ticket_number": index,
                "response_id": str(response.id),
                "entry_label": label,
                "short_label": label[:30].rstrip() + ("…" if len(label) > 30 else ""),
                "selected_values": selected_values,
                "completed_at": response.completed_at.isoformat() if response.completed_at else "",
            }
        )

    return entries


def build_lottery_payload(survey):
    lottery_settings = normalize_lottery_settings(survey.settings)
    history = lottery_settings["history"]
    selected_fields = lottery_settings["selected_fields"]
    drawn_response_ids = {
        draw["response_id"]
        for draw in history
        if draw.get("response_id")
    }
    entries = build_lottery_entries(
        survey,
        selected_fields,
        exclude_response_ids=drawn_response_ids if lottery_settings["exclude_previous_winners"] else None,
    )

    return {
        "settings": lottery_settings,
        "available_fields": build_lottery_field_catalog(survey),
        "entries": entries,
        "history": history,
        "stats": {
            "completed_responses": survey.responses.filter(
                status=SurveyResponse.Status.COMPLETED
            ).count(),
            "eligible_entries": len(entries),
            "drawn_count": len(history),
            "remaining_prize_slots": max(
                len(lottery_settings["prize_slots"]) - len(history),
                0,
            ),
        },
    }


def draw_lottery_winner(survey, prize_label):
    lottery_settings = normalize_lottery_settings(survey.settings)
    selected_fields = lottery_settings["selected_fields"]
    prize_slots = lottery_settings["prize_slots"]
    history = list(lottery_settings["history"])

    if not selected_fields:
        raise ValueError("Choose at least one display field before drawing a winner.")

    normalized_prize_label = str(prize_label or "").strip()
    if normalized_prize_label:
        if normalized_prize_label not in prize_slots:
            raise ValueError("Prize slot not found for this survey lottery.")
        if any(draw["prize_label"] == normalized_prize_label for draw in history):
            raise ValueError("That prize slot already has a winner.")
    else:
        normalized_prize_label = next(
            (
                slot
                for slot in prize_slots
                if not any(draw["prize_label"] == slot for draw in history)
            ),
            "",
        )
        if not normalized_prize_label:
            raise ValueError("All configured prize slots already have winners.")

    drawn_response_ids = {
        draw["response_id"]
        for draw in history
        if draw.get("response_id")
    }
    entries = build_lottery_entries(
        survey,
        selected_fields,
        exclude_response_ids=drawn_response_ids if lottery_settings["exclude_previous_winners"] else None,
    )
    if not entries:
        raise ValueError("No eligible entries are available for this draw.")

    winner = secrets.choice(entries)
    draw_record = {
        "id": str(uuid.uuid4()),
        "prize_label": normalized_prize_label,
        "response_id": winner["response_id"],
        "entry_label": winner["entry_label"],
        "selected_values": winner["selected_values"],
        "drawn_at": timezone.now().isoformat(),
    }
    history.append(draw_record)
    lottery_settings["history"] = history
    set_lottery_settings(survey, lottery_settings)

    return {
        "draw": draw_record,
        "entries": entries,
        "settings": normalize_lottery_settings(survey.settings),
        "history": history,
    }


def reset_lottery_history(survey):
    lottery_settings = normalize_lottery_settings(survey.settings)
    lottery_settings["history"] = []
    set_lottery_settings(survey, lottery_settings)
    return build_lottery_payload(survey)
