from dataclasses import dataclass

from django.core.exceptions import ImproperlyConfigured

from accounts.models import SiteSettings
from surveys.models import Question, Survey, SurveyResponse

from .models import Plan, UserSubscription


@dataclass(frozen=True)
class LimitCheckResult:
    allowed: bool
    message: str = ""


class LicenseService:
    FREE_PLAN_SLUG = "free"

    @classmethod
    def get_free_plan(cls):
        free_plan = Plan.objects.filter(slug=cls.FREE_PLAN_SLUG).first()
        if not free_plan:
            raise ImproperlyConfigured("Default Free plan is missing.")
        return free_plan

    @classmethod
    def get_user_subscription(cls, user, *, for_update=False):
        queryset = UserSubscription.objects.select_related("plan")
        if for_update:
            queryset = queryset.select_for_update()

        subscription = queryset.filter(user=user).first()
        if subscription:
            return subscription

        free_plan = cls.get_free_plan()
        subscription, _ = UserSubscription.objects.get_or_create(
            user=user,
            defaults={
                "plan": free_plan,
                "status": UserSubscription.Status.ACTIVE,
                "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
                "payment_provider": UserSubscription.PaymentProvider.NONE,
            },
        )
        if for_update:
            subscription = (
                UserSubscription.objects.select_related("plan")
                .select_for_update()
                .get(pk=subscription.pk)
            )
        return subscription

    @classmethod
    def get_user_plan(cls, user, *, for_update=False):
        return cls.get_user_subscription(user, for_update=for_update).plan

    @classmethod
    def get_usage_snapshot(cls, user):
        plan = cls.get_user_plan(user)
        used_surveys = Survey.objects.filter(user=user).count()
        return {
            "surveys": {
                "used": used_surveys,
                "limit": plan.max_surveys,
                "unlimited": plan.max_surveys == 0,
            },
            "questions_per_survey": {
                "limit": plan.max_questions_per_survey,
                "unlimited": plan.max_questions_per_survey == 0,
            },
            "responses_per_survey": {
                "limit": plan.max_responses_per_survey,
                "unlimited": plan.max_responses_per_survey == 0,
            },
            "plan": {
                "name": plan.name,
                "slug": plan.slug,
                "tier": plan.tier,
            },
        }

    @classmethod
    def check_can_create_survey(cls, user, *, for_update=False):
        plan = cls.get_user_plan(user, for_update=for_update)
        if plan.max_surveys == 0:
            return LimitCheckResult(True)

        survey_count = Survey.objects.filter(user=user).count()
        if survey_count >= plan.max_surveys:
            return LimitCheckResult(
                False,
                f"You've reached the maximum of {plan.max_surveys} surveys on the {plan.name} plan. Upgrade to create more.",
            )

        return LimitCheckResult(True)

    @classmethod
    def check_can_duplicate_survey(cls, survey, *, for_update=False):
        create_check = cls.check_can_create_survey(survey.user, for_update=for_update)
        if not create_check.allowed:
            return create_check

        plan = cls.get_user_plan(survey.user, for_update=for_update)
        if plan.max_questions_per_survey == 0:
            return LimitCheckResult(True)

        question_count = Question.objects.filter(page__survey=survey).count()
        if question_count > plan.max_questions_per_survey:
            return LimitCheckResult(
                False,
                f'This survey has {question_count} questions, which exceeds the {plan.name} plan limit of {plan.max_questions_per_survey} questions per survey. Upgrade to duplicate it.',
            )

        return LimitCheckResult(True)

    @classmethod
    def check_can_add_question(cls, survey, *, extra_questions=1, for_update=False):
        plan = cls.get_user_plan(survey.user, for_update=for_update)
        if plan.max_questions_per_survey == 0:
            return LimitCheckResult(True)

        question_count = Question.objects.filter(page__survey=survey).count()
        if question_count + extra_questions > plan.max_questions_per_survey:
            return LimitCheckResult(
                False,
                f"You've reached the maximum of {plan.max_questions_per_survey} questions on the {plan.name} plan for a single survey. Upgrade to add more.",
            )

        return LimitCheckResult(True)

    @classmethod
    def check_can_accept_response(cls, survey, *, for_update=False):
        plan = cls.get_user_plan(survey.user, for_update=for_update)
        if plan.max_responses_per_survey == 0:
            return LimitCheckResult(True)

        completed_count = SurveyResponse.objects.filter(
            survey=survey,
            status=SurveyResponse.Status.COMPLETED,
        ).count()
        if completed_count >= plan.max_responses_per_survey:
            return LimitCheckResult(
                False,
                "This survey has reached its response limit.",
            )

        return LimitCheckResult(True)

    @classmethod
    def get_logged_in_users_only_default(cls):
        site_settings, _ = SiteSettings.objects.get_or_create(pk=1)
        return site_settings.logged_in_users_only_default
