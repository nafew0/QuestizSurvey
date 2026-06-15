import re

from surveys.models import Question


OPEN_ENDED_OTHER_KEY = "__other__"

VALIDATION_TYPES = {
    "email",
    "phone",
    "text_only",
    "numbers_only",
    "url",
    "alphanumeric",
}

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_PATTERN = re.compile(r"^\+?[\d\s().-]+$")
NUMBER_PATTERN = re.compile(r"^-?\d+(\.\d+)?$")


def _normalize_numeric_setting(value):
    if value in (None, ""):
        return None

    try:
        if isinstance(value, int):
            return value
        number = float(value)
    except (TypeError, ValueError):
        return None

    if number.is_integer():
        return int(number)
    return number


def normalize_input_validation_rule(rule):
    if not isinstance(rule, dict):
        return {}

    normalized_rule = {
        "enabled": bool(rule.get("enabled")),
        "type": rule.get("type") if rule.get("type") in VALIDATION_TYPES else "",
        "char_limit": _normalize_numeric_setting(rule.get("char_limit")),
        "min_number": _normalize_numeric_setting(rule.get("min_number")),
        "max_number": _normalize_numeric_setting(rule.get("max_number")),
    }

    return normalized_rule


def normalize_question_input_validation_settings(settings):
    normalized_settings = dict(settings or {})
    normalized_settings["input_validation"] = normalize_input_validation_rule(
        normalized_settings.get("input_validation")
    )

    row_validations = normalized_settings.get("row_validations")
    if isinstance(row_validations, dict):
        normalized_settings["row_validations"] = {
            str(row_key): normalize_input_validation_rule(rule)
            for row_key, rule in row_validations.items()
        }
    else:
        normalized_settings["row_validations"] = {}

    return normalized_settings


def validate_input_validation_rule_configuration(rule):
    normalized_rule = normalize_input_validation_rule(rule)

    if not normalized_rule["enabled"] or not normalized_rule["type"]:
        return ""

    if normalized_rule["type"] == "text_only":
        char_limit = normalized_rule["char_limit"]
        if char_limit is not None and char_limit <= 0:
            return "Character limit must be greater than 0."

    if normalized_rule["type"] == "numbers_only":
        min_number = normalized_rule["min_number"]
        max_number = normalized_rule["max_number"]

        if (
            min_number is not None
            and max_number is not None
            and min_number >= max_number
        ):
            return 'The "From" value must be less than the "To" value.'

    return ""


def validate_question_input_validation_settings(settings):
    normalized_settings = normalize_question_input_validation_settings(settings)
    errors = {}

    input_validation_error = validate_input_validation_rule_configuration(
        normalized_settings.get("input_validation")
    )
    if input_validation_error:
        errors["input_validation"] = input_validation_error

    row_validation_errors = {}
    for row_key, rule in (normalized_settings.get("row_validations") or {}).items():
        validation_error = validate_input_validation_rule_configuration(rule)
        if validation_error:
            row_validation_errors[str(row_key)] = validation_error

    if row_validation_errors:
        errors["row_validations"] = row_validation_errors

    return errors


def _is_valid_phone_number(value):
    if not PHONE_PATTERN.match(value):
        return False

    digits_only = re.sub(r"\D", "", value)
    return 7 <= len(digits_only) <= 15


def _is_valid_url(value):
    return value.startswith(("http://", "https://")) and "." in value.split("://", 1)[-1]


def validate_input_value(value, rule):
    normalized_rule = normalize_input_validation_rule(rule)
    trimmed_value = str(value or "").strip()

    if not normalized_rule["enabled"] or not normalized_rule["type"] or not trimmed_value:
        return ""

    if normalized_rule["type"] == "email":
        return "" if EMAIL_PATTERN.match(trimmed_value) else "Enter a valid email address."

    if normalized_rule["type"] == "phone":
        return "" if _is_valid_phone_number(trimmed_value) else "Enter a valid phone number."

    if normalized_rule["type"] == "text_only":
        if not all(
            character.isalpha() or character.isspace() or character in "'.,-"
            for character in trimmed_value
        ):
            return "Use letters and text characters only."

        char_limit = normalized_rule["char_limit"]
        if char_limit and len(trimmed_value) > char_limit:
            return f"Use no more than {char_limit} characters."

        return ""

    if normalized_rule["type"] == "numbers_only":
        if not NUMBER_PATTERN.match(trimmed_value):
            return "Enter numbers only."

        numeric_value = float(trimmed_value)
        min_number = normalized_rule["min_number"]
        max_number = normalized_rule["max_number"]

        if min_number is not None and numeric_value < min_number:
            return f"Enter a value greater than or equal to {min_number}."

        if max_number is not None and numeric_value > max_number:
            return f"Enter a value less than or equal to {max_number}."

        return ""

    if normalized_rule["type"] == "url":
        return "" if _is_valid_url(trimmed_value) else "Enter a valid URL."

    if normalized_rule["type"] == "alphanumeric":
        return (
            ""
            if all(character.isalnum() or character.isspace() or character in "'.,-" for character in trimmed_value)
            else "Use letters and numbers only."
        )

    return ""


def validate_question_input_answer(question, answer_data):
    settings = normalize_question_input_validation_settings(getattr(question, "settings", {}) or {})

    if question.question_type in {
        Question.QuestionType.SHORT_TEXT,
        Question.QuestionType.LONG_TEXT,
    }:
        error_message = validate_input_value(answer_data.get("text_value", ""), settings.get("input_validation"))
        if error_message:
            return f'{question.text}: {error_message}'
        return ""

    if question.question_type == Question.QuestionType.OPEN_ENDED:
        matrix_data = answer_data.get("matrix_data") or {}
        row_validations = settings.get("row_validations", {})

        for row_key, rule in row_validations.items():
            row_value = matrix_data.get(row_key, "")
            error_message = validate_input_value(row_value, rule)
            if error_message:
                row_label = "Other" if row_key == OPEN_ENDED_OTHER_KEY else row_key
                return f'{question.text} ({row_label}): {error_message}'

        return ""

    return ""
