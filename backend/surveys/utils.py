import uuid
from copy import deepcopy

from django.db import transaction


def generate_short_token():
    return uuid.uuid4().hex[:12]


def remap_json_identifiers(value, identifier_map):
    if isinstance(value, dict):
        remapped = {}
        for key, nested_value in value.items():
            new_key = identifier_map.get(key, key) if isinstance(key, str) else key
            remapped[new_key] = remap_json_identifiers(nested_value, identifier_map)
        return remapped

    if isinstance(value, list):
        return [remap_json_identifiers(item, identifier_map) for item in value]

    if isinstance(value, str):
        return identifier_map.get(value, value)

    return value


@transaction.atomic
def duplicate_survey_structure(survey, user):
    from .models import Choice, Page, Question, Survey

    duplicated_survey = Survey.objects.create(
        user=user,
        title=f"{survey.title} (Copy)",
        description=survey.description,
        status=Survey.Status.DRAFT,
        theme=deepcopy(survey.theme),
        settings=deepcopy(survey.settings),
        welcome_page=deepcopy(survey.welcome_page),
        thank_you_page=deepcopy(survey.thank_you_page),
    )

    identifier_map = {str(survey.id): str(duplicated_survey.id)}
    page_pairs = []
    question_pairs = []

    original_pages = survey.pages.prefetch_related("questions__choices")
    for page in original_pages.all():
        duplicated_page = Page.objects.create(
            survey=duplicated_survey,
            title=page.title,
            description=page.description,
            order=page.order,
            skip_logic=deepcopy(page.skip_logic),
        )
        identifier_map[str(page.id)] = str(duplicated_page.id)
        page_pairs.append((page, duplicated_page))

        for question in page.questions.all():
            duplicated_question = Question.objects.create(
                page=duplicated_page,
                question_type=question.question_type,
                text=question.text,
                description=question.description,
                required=question.required,
                order=question.order,
                settings=deepcopy(question.settings),
                skip_logic=deepcopy(question.skip_logic),
            )
            identifier_map[str(question.id)] = str(duplicated_question.id)
            question_pairs.append((question, duplicated_question))

            for choice in question.choices.all():
                duplicated_choice = Choice.objects.create(
                    question=duplicated_question,
                    text=choice.text,
                    image_url=choice.image_url,
                    is_other=choice.is_other,
                    order=choice.order,
                    score=choice.score,
                )
                identifier_map[str(choice.id)] = str(duplicated_choice.id)

    duplicated_survey.settings = remap_json_identifiers(
        duplicated_survey.settings, identifier_map
    )
    duplicated_survey.welcome_page = remap_json_identifiers(
        duplicated_survey.welcome_page, identifier_map
    )
    duplicated_survey.thank_you_page = remap_json_identifiers(
        duplicated_survey.thank_you_page, identifier_map
    )
    duplicated_survey.save(
        update_fields=["settings", "welcome_page", "thank_you_page", "updated_at"]
    )

    for _, duplicated_page in page_pairs:
        duplicated_page.skip_logic = remap_json_identifiers(
            duplicated_page.skip_logic, identifier_map
        )
        duplicated_page.save(update_fields=["skip_logic"])

    for _, duplicated_question in question_pairs:
        duplicated_question.settings = remap_json_identifiers(
            duplicated_question.settings, identifier_map
        )
        duplicated_question.skip_logic = remap_json_identifiers(
            duplicated_question.skip_logic,
            identifier_map,
        )
        duplicated_question.save(update_fields=["settings", "skip_logic"])

    return duplicated_survey
