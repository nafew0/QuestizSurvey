from django.shortcuts import get_object_or_404

from surveys.models import Page, Survey


def get_owned_survey(user, survey_pk):
    return get_object_or_404(Survey, id=survey_pk, user=user)


def get_owned_page(user, survey_pk, page_pk):
    survey = get_owned_survey(user, survey_pk)
    page = get_object_or_404(Page, id=page_pk, survey=survey)
    return survey, page
