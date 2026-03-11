from surveys.models import Question


OPEN_ENDED_OTHER_KEY = "__other__"


def _is_blank(value):
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, bool):
        return not value
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0
    return False


def _ordered_with_extras(preferred_keys, actual_keys):
    ordered = []
    seen = set()

    for key in preferred_keys:
        if key in seen:
            continue
        ordered.append(key)
        seen.add(key)

    for key in actual_keys:
        if key in seen:
            continue
        ordered.append(key)
        seen.add(key)

    return ordered


def _ordered_demographic_fields(question, matrix_data):
    configured_fields = (getattr(question, "settings", {}) or {}).get("fields", {})

    if isinstance(configured_fields, list):
        preferred = configured_fields
    else:
        preferred = [
            field_name
            for field_name, enabled in configured_fields.items()
            if enabled
        ]

    return _ordered_with_extras(preferred, matrix_data.keys())


def iter_matrix_answer_fragments(question, matrix_data):
    if not isinstance(matrix_data, dict):
        return []

    question_type = getattr(question, "question_type", "")
    settings = getattr(question, "settings", {}) or {}
    fragments = []

    if question_type == Question.QuestionType.OPEN_ENDED:
        preferred_keys = list(settings.get("rows", []))
        if settings.get("allow_other"):
            preferred_keys.append(OPEN_ENDED_OTHER_KEY)

        for key in _ordered_with_extras(preferred_keys, matrix_data.keys()):
            value = matrix_data.get(key)
            if _is_blank(value):
                continue
            label = "Other" if key == OPEN_ENDED_OTHER_KEY else key
            fragments.append(f"{label}: {str(value).strip()}")

        return fragments

    if question_type == Question.QuestionType.DEMOGRAPHICS:
        for key in _ordered_demographic_fields(question, matrix_data):
            value = matrix_data.get(key)
            if _is_blank(value):
                continue
            fragments.append(f"{key}: {str(value).strip()}")

        return fragments

    if question_type == Question.QuestionType.MATRIX_PLUS:
        preferred_rows = list(settings.get("rows", []))
        preferred_columns = list(settings.get("columns", []))

        for row_label in _ordered_with_extras(preferred_rows, matrix_data.keys()):
            cell_map = matrix_data.get(row_label)
            if isinstance(cell_map, dict):
                for column_label in _ordered_with_extras(
                    preferred_columns, cell_map.keys()
                ):
                    value = cell_map.get(column_label)
                    if _is_blank(value):
                        continue
                    fragments.append(
                        f"{row_label} / {column_label}: {str(value).strip()}"
                    )
            elif not _is_blank(cell_map):
                fragments.append(f"{row_label}: {str(cell_map).strip()}")

        return fragments

    for key, value in matrix_data.items():
        if isinstance(value, dict):
            if all(isinstance(selected, bool) for selected in value.values()):
                selected_labels = [
                    label for label, is_selected in value.items() if is_selected
                ]
                if selected_labels:
                    fragments.append(f"{key}: {', '.join(selected_labels)}")
                continue

            for nested_key, nested_value in value.items():
                if _is_blank(nested_value):
                    continue
                fragments.append(f"{key} / {nested_key}: {str(nested_value).strip()}")
            continue

        if _is_blank(value):
            continue

        fragments.append(f"{key}: {str(value).strip()}")

    return fragments


def format_matrix_answer(question, matrix_data, *, separator="; "):
    return separator.join(iter_matrix_answer_fragments(question, matrix_data))


def build_answer_search_blob(answer):
    parts = [
        getattr(answer, "text_value", "") or "",
        getattr(answer, "other_text", "") or "",
        format_matrix_answer(getattr(answer, "question", None), getattr(answer, "matrix_data", None), separator=" "),
    ]

    return " ".join(part for part in parts if part).strip()
