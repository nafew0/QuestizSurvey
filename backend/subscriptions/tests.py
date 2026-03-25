from datetime import timedelta
from decimal import Decimal
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from subscriptions.bkash_service import BkashApiError, BkashService, BkashServiceError
from subscriptions.models import BkashTransaction, Plan, SubscriptionEvent, UserSubscription
from subscriptions.tasks import (
    check_expired_subscriptions,
    check_expiring_subscriptions,
    expire_stale_bkash_transactions,
)
from subscriptions.throttles import PaymentCheckoutThrottle, PaymentStatusThrottle
from surveys.models import Collector, Page, Question, Survey, SurveyResponse

User = get_user_model()


class SubscriptionApiAndLimitsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.public_client = APIClient()
        self.user = User.objects.create_user(
            username="planowner",
            email="planowner@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(self.user)
        self.free_plan = Plan.objects.get(slug="free")

    def create_survey(self, *, title="Survey", owner=None, status=Survey.Status.DRAFT):
        return Survey.objects.create(
            user=owner or self.user,
            title=title,
            status=status,
        )

    def create_page(self, survey, *, order=1):
        return Page.objects.create(
            survey=survey,
            title=f"Page {order}",
            order=order,
        )

    def create_question(self, page, *, order=1, text=None):
        return Question.objects.create(
            page=page,
            question_type=Question.QuestionType.SHORT_TEXT,
            text=text or f"Question {order}",
            order=order,
        )

    def test_plans_endpoint_lists_seeded_active_plans(self):
        response = self.public_client.get("/api/plans/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [plan["slug"] for plan in response.data], ["free", "pro", "enterprise"]
        )
        self.assertIn("bkash_price_monthly", response.data[0])
        self.assertIn("bkash_price_yearly", response.data[0])

    def test_subscription_endpoint_auto_creates_free_subscription(self):
        self.assertFalse(UserSubscription.objects.filter(user=self.user).exists())

        response = self.client.get("/api/subscription/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["plan"]["slug"], "free")
        self.assertTrue(
            UserSubscription.objects.filter(
                user=self.user, plan=self.free_plan
            ).exists()
        )

    def test_usage_endpoint_returns_plan_and_usage_snapshot(self):
        self.create_survey(title="Survey A")
        self.create_survey(title="Survey B")

        response = self.client.get("/api/subscription/usage/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["plan"]["slug"], "free")
        self.assertEqual(response.data["surveys"]["used"], 2)
        self.assertEqual(response.data["surveys"]["limit"], self.free_plan.max_surveys)
        self.assertFalse(response.data["surveys"]["unlimited"])

    def test_create_survey_is_blocked_when_plan_limit_is_reached(self):
        self.free_plan.max_surveys = 1
        self.free_plan.save(update_fields=["max_surveys"])
        self.create_survey(title="Existing survey")

        response = self.client.post(
            "/api/surveys/",
            {
                "title": "Blocked survey",
                "description": "Should not be created",
                "theme": {},
                "settings": {},
                "welcome_page": {},
                "thank_you_page": {},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "plan_limit")

    def test_duplicate_survey_is_blocked_when_user_has_no_remaining_slots(self):
        self.free_plan.max_surveys = 1
        self.free_plan.save(update_fields=["max_surveys"])
        survey = self.create_survey(title="Original")

        response = self.client.post(
            f"/api/surveys/{survey.id}/duplicate/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "plan_limit")
        self.assertEqual(Survey.objects.filter(user=self.user).count(), 1)

    def test_create_question_is_blocked_when_plan_question_limit_is_reached(self):
        self.free_plan.max_questions_per_survey = 1
        self.free_plan.save(update_fields=["max_questions_per_survey"])
        survey = self.create_survey(title="Question limited survey")
        page = self.create_page(survey)
        self.create_question(page)

        response = self.client.post(
            f"/api/surveys/{survey.id}/pages/{page.id}/questions/",
            {
                "question_type": Question.QuestionType.SHORT_TEXT,
                "text": "Blocked question",
                "description": "",
                "required": False,
                "order": 2,
                "settings": {},
                "skip_logic": None,
                "choices": [],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "plan_limit")
        self.assertEqual(Question.objects.filter(page=page).count(), 1)

    def test_public_submission_is_blocked_when_plan_response_limit_is_reached(self):
        self.free_plan.max_responses_per_survey = 1
        self.free_plan.save(update_fields=["max_responses_per_survey"])

        survey = self.create_survey(
            title="Response limited survey", status=Survey.Status.ACTIVE
        )
        page = self.create_page(survey)
        question = self.create_question(page, text="Your feedback?")
        Collector.objects.create(
            survey=survey,
            type=Collector.CollectorType.WEB_LINK,
            name="Default link",
            status=Collector.Status.OPEN,
        )
        SurveyResponse.objects.create(
            survey=survey,
            status=SurveyResponse.Status.COMPLETED,
            completed_at=timezone.now(),
        )

        response = self.public_client.post(
            f"/api/public/surveys/{survey.slug}/",
            {
                "status": SurveyResponse.Status.COMPLETED,
                "current_page": str(page.id),
                "answers": [
                    {
                        "question": str(question.id),
                        "text_value": "One more response",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "plan_limit")


@override_settings(
    PUBLIC_APP_URL="http://localhost:5555",
    STRIPE_SECRET_KEY="sk_test_123",
    STRIPE_PUBLISHABLE_KEY="pk_test_123",
    STRIPE_WEBHOOK_SECRET="whsec_test_123",
)
class StripePaymentTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.public_client = APIClient()
        self.user = User.objects.create_user(
            username="stripeuser",
            email="stripeuser@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(self.user)
        self.free_plan = Plan.objects.get(slug="free")
        self.pro_plan = Plan.objects.get(slug="pro")
        self.pro_plan.stripe_price_id_monthly = "price_pro_monthly"
        self.pro_plan.stripe_price_id_yearly = "price_pro_yearly"
        self.pro_plan.save(
            update_fields=["stripe_price_id_monthly", "stripe_price_id_yearly"]
        )

    def test_stripe_config_endpoint_returns_publishable_key(self):
        response = self.public_client.get("/api/payments/stripe/config/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["publishable_key"], "pk_test_123")

    @patch("subscriptions.stripe_service.stripe.checkout.Session.create")
    @patch("subscriptions.stripe_service.stripe.Customer.create")
    def test_create_checkout_endpoint_returns_checkout_url(
        self,
        customer_create_mock,
        checkout_create_mock,
    ):
        customer_create_mock.return_value = {"id": "cus_123"}
        checkout_create_mock.return_value = {
            "id": "cs_test_123",
            "url": "https://checkout.stripe.com/pay/cs_test_123",
        }

        response = self.client.post(
            "/api/payments/stripe/create-checkout/",
            {
                "plan_id": str(self.pro_plan.id),
                "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["checkout_url"],
            "https://checkout.stripe.com/pay/cs_test_123",
        )
        subscription = UserSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.stripe_customer_id, "cus_123")
        checkout_create_mock.assert_called_once()

    def test_create_checkout_rejects_free_plan(self):
        response = self.client.post(
            "/api/payments/stripe/create-checkout/",
            {
                "plan_id": str(self.free_plan.id),
                "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("subscriptions.stripe_service.stripe.billing_portal.Session.create")
    def test_customer_portal_returns_portal_url(self, portal_create_mock):
        subscription = UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.STRIPE,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_123",
        )
        portal_create_mock.return_value = {
            "url": "https://billing.stripe.com/session/test",
        }

        response = self.client.post("/api/payments/stripe/customer-portal/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["portal_url"],
            "https://billing.stripe.com/session/test",
        )
        subscription.refresh_from_db()
        self.assertEqual(subscription.stripe_customer_id, "cus_123")

    @patch("subscriptions.stripe_views.StripeService.create_checkout_session")
    def test_create_checkout_endpoint_is_throttled(self, create_checkout_session_mock):
        create_checkout_session_mock.return_value = "https://checkout.stripe.com/pay/cs_test_123"

        with patch.object(PaymentCheckoutThrottle, "rate", "1/min"):
            first_response = self.client.post(
                "/api/payments/stripe/create-checkout/",
                {
                    "plan_id": str(self.pro_plan.id),
                    "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
                },
                format="json",
            )
            second_response = self.client.post(
                "/api/payments/stripe/create-checkout/",
                {
                    "plan_id": str(self.pro_plan.id),
                    "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
                },
                format="json",
            )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @patch("subscriptions.stripe_service.stripe.billing_portal.Session.create")
    def test_customer_portal_endpoint_is_throttled(self, portal_create_mock):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.STRIPE,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_123",
        )
        portal_create_mock.return_value = {
            "url": "https://billing.stripe.com/session/test",
        }

        with patch.object(PaymentCheckoutThrottle, "rate", "1/min"):
            first_response = self.client.post("/api/payments/stripe/customer-portal/")
            second_response = self.client.post("/api/payments/stripe/customer-portal/")

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @patch("subscriptions.stripe_views.StripeService.create_checkout_session")
    def test_create_checkout_writes_audit_log(self, create_checkout_session_mock):
        create_checkout_session_mock.return_value = "https://checkout.stripe.com/pay/cs_test_123"

        with self.assertLogs("audit", level="INFO") as captured:
            response = self.client.post(
                "/api/payments/stripe/create-checkout/",
                {
                    "plan_id": str(self.pro_plan.id),
                    "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any('"event": "stripe_checkout"' in message for message in captured.output))

    @patch("subscriptions.stripe_service.stripe.Subscription.retrieve")
    @patch("subscriptions.stripe_service.stripe.Webhook.construct_event")
    def test_webhook_checkout_session_completed_updates_subscription(
        self,
        construct_event_mock,
        subscription_retrieve_mock,
    ):
        construct_event_mock.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "mode": "subscription",
                    "customer": "cus_123",
                    "subscription": "sub_123",
                    "metadata": {"user_id": str(self.user.id)},
                }
            },
        }
        subscription_retrieve_mock.return_value = {
            "id": "sub_123",
            "customer": "cus_123",
            "status": "active",
            "current_period_start": 1735689600,
            "current_period_end": 1738368000,
            "items": {
                "data": [
                    {
                        "price": {"id": "price_pro_yearly"},
                    }
                ]
            },
            "metadata": {"user_id": str(self.user.id)},
        }

        response = self.public_client.post(
            "/api/payments/stripe/webhook/",
            data=b"{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig_test",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        subscription = UserSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.plan, self.pro_plan)
        self.assertEqual(subscription.status, UserSubscription.Status.ACTIVE)
        self.assertEqual(
            subscription.payment_provider,
            UserSubscription.PaymentProvider.STRIPE,
        )
        self.assertEqual(
            subscription.billing_cycle,
            UserSubscription.BillingCycle.YEARLY,
        )
        self.assertEqual(subscription.stripe_subscription_id, "sub_123")
        self.assertTrue(
            SubscriptionEvent.objects.filter(
                user=self.user,
                event_type=SubscriptionEvent.EventType.STRIPE_SYNC,
            ).exists()
        )

    @patch("subscriptions.stripe_service.stripe.Webhook.construct_event")
    def test_webhook_invoice_payment_failed_marks_subscription_past_due(
        self,
        construct_event_mock,
    ):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.STRIPE,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_123",
        )
        construct_event_mock.return_value = {
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "customer": "cus_123",
                    "subscription": "sub_123",
                }
            },
        }

        response = self.public_client.post(
            "/api/payments/stripe/webhook/",
            data=b"{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig_test",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        subscription = UserSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.status, UserSubscription.Status.PAST_DUE)

    @patch("subscriptions.stripe_service.stripe.Webhook.construct_event")
    def test_webhook_subscription_deleted_downgrades_to_free(
        self, construct_event_mock
    ):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.STRIPE,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_123",
        )
        construct_event_mock.return_value = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_123",
                    "customer": "cus_123",
                    "metadata": {"user_id": str(self.user.id)},
                }
            },
        }

        response = self.public_client.post(
            "/api/payments/stripe/webhook/",
            data=b"{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig_test",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        subscription = UserSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.plan.slug, "free")
        self.assertEqual(
            subscription.payment_provider,
            UserSubscription.PaymentProvider.NONE,
        )


@override_settings(
    API_ORIGIN="http://localhost:8000",
    PUBLIC_APP_URL="http://localhost:5555",
    BKASH_APP_KEY="app_key",
    BKASH_APP_SECRET="app_secret",
    BKASH_USERNAME="username",
    BKASH_PASSWORD="password",
    BKASH_BASE_URL="https://tokenized.sandbox.bka.sh/v1.2.0-beta",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class BkashServiceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="bkashservice",
            email="bkashservice@example.com",
            password="TestPass123!",
        )
        self.plan = Plan.objects.get(slug="pro")
        self.plan.bkash_price_monthly = 2900
        self.plan.bkash_price_yearly = 29000
        self.plan.save(update_fields=["bkash_price_monthly", "bkash_price_yearly"])

    def _mock_urlopen_response(self, payload):
        response = Mock()
        response.read.return_value = payload.encode("utf-8")
        context_manager = Mock()
        context_manager.__enter__ = Mock(return_value=response)
        context_manager.__exit__ = Mock(return_value=False)
        return context_manager

    @patch("subscriptions.bkash_service.urlopen")
    def test_grant_token_caches_id_token(self, urlopen_mock):
        urlopen_mock.return_value = self._mock_urlopen_response(
            '{"statusCode":"0000","id_token":"token_1","refresh_token":"refresh_1","expires_in":3600}'
        )

        first_token = BkashService.grant_token(force_refresh=True)
        second_token = BkashService.grant_token()

        self.assertEqual(first_token, "token_1")
        self.assertEqual(second_token, "token_1")
        self.assertEqual(urlopen_mock.call_count, 1)

    @patch.object(BkashService, "_request")
    def test_authorized_request_refreshes_token_after_auth_failure(self, request_mock):
        cache.set(
            BkashService.TOKEN_CACHE_KEY,
            {
                "id_token": "stale_token",
                "refresh_token": "refresh_token",
                "expires_in": 3600,
            },
        )
        request_mock.side_effect = [
            BkashApiError(
                "expired token", response_data={"statusCode": "2001"}, http_status=401
            ),
            {
                "statusCode": "0000",
                "id_token": "fresh_token",
                "refresh_token": "refresh_token_2",
                "expires_in": 3600,
            },
            {
                "statusCode": "0000",
                "transactionStatus": "Completed",
                "trxID": "trx_123",
            },
        ]

        response = BkashService.query_payment("payment_123")

        self.assertEqual(response["trxID"], "trx_123")
        self.assertEqual(request_mock.call_count, 3)

    @patch.object(BkashService, "_authorized_request")
    def test_create_payment_uses_bdt_amount_and_callback_url(
        self, authorized_request_mock
    ):
        authorized_request_mock.return_value = {
            "statusCode": "0000",
            "paymentID": "payment_123",
            "bkashURL": "https://sandbox.payment/bkash/123",
        }

        response = BkashService.create_payment(
            self.user,
            self.plan,
            UserSubscription.BillingCycle.YEARLY,
        )

        payload = authorized_request_mock.call_args.kwargs["payload"]
        self.assertEqual(payload["currency"], "BDT")
        self.assertEqual(payload["amount"], "29000.00")
        self.assertEqual(
            payload["callbackURL"],
            "http://localhost:8000/api/payments/bkash/callback/",
        )
        self.assertEqual(response["payment_id"], "payment_123")
        self.assertTrue(response["invoice_number"].startswith("QTZ-BK-"))

    @patch.object(BkashService, "_authorized_request")
    def test_execute_payment_raises_on_gateway_failure(self, authorized_request_mock):
        authorized_request_mock.return_value = {
            "statusCode": "2062",
            "statusMessage": "Payment execution failed",
        }

        with self.assertRaises(BkashServiceError):
            BkashService.execute_payment("payment_123")

    @patch.object(BkashService, "_authorized_request")
    def test_search_transaction_queries_provider_by_trx_id(
        self, authorized_request_mock
    ):
        authorized_request_mock.return_value = {
            "statusCode": "0000",
            "paymentID": "payment_123",
            "trxID": "trx_123",
        }

        response = BkashService.search_transaction("trx_123")

        self.assertEqual(response["paymentID"], "payment_123")
        self.assertEqual(
            authorized_request_mock.call_args.args,
            ("GET", "/tokenized/checkout/payment/search/trx_123"),
        )

    def test_already_processed_detection_handles_status_code_2029(self):
        self.assertTrue(
            BkashService._looks_already_processed(
                {"statusCode": "2029", "statusMessage": "Duplicate payment"}
            )
        )


@override_settings(
    API_ORIGIN="http://localhost:8000",
    PUBLIC_APP_URL="http://localhost:5555",
    BKASH_APP_KEY="app_key",
    BKASH_APP_SECRET="app_secret",
    BKASH_USERNAME="username",
    BKASH_PASSWORD="password",
    BKASH_BASE_URL="https://tokenized.sandbox.bka.sh/v1.2.0-beta",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class BkashPaymentTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.public_client = APIClient()
        self.user = User.objects.create_user(
            username="bkashuser",
            email="bkashuser@example.com",
            password="TestPass123!",
        )
        self.other_user = User.objects.create_user(
            username="otheruser",
            email="other@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(self.user)
        self.free_plan = Plan.objects.get(slug="free")
        self.pro_plan = Plan.objects.get(slug="pro")
        self.pro_plan.bkash_price_monthly = 2900
        self.pro_plan.bkash_price_yearly = 29000
        self.pro_plan.save(update_fields=["bkash_price_monthly", "bkash_price_yearly"])

    @patch.object(BkashService, "create_payment")
    def test_create_checkout_stores_initiated_transaction_and_returns_url(
        self,
        create_payment_mock,
    ):
        create_payment_mock.return_value = {
            "payment_id": "payment_123",
            "bkash_url": "https://sandbox.payment/bkash/123",
            "invoice_number": "INV-123",
            "amount": self.pro_plan.bkash_price_monthly,
            "response": {"statusCode": "0000"},
        }

        response = self.client.post(
            "/api/payments/bkash/create/",
            {
                "plan_id": str(self.pro_plan.id),
                "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["payment_id"], "payment_123")
        transaction_record = BkashTransaction.objects.get(payment_id="payment_123")
        self.assertEqual(transaction_record.status, BkashTransaction.Status.INITIATED)
        self.assertEqual(transaction_record.target_plan, self.pro_plan)

    def test_create_checkout_rejects_missing_bdt_price(self):
        self.pro_plan.bkash_price_monthly = 0
        self.pro_plan.save(update_fields=["bkash_price_monthly"])

        response = self.client.post(
            "/api/payments/bkash/create/",
            {
                "plan_id": str(self.pro_plan.id),
                "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch.object(BkashService, "create_payment")
    def test_create_checkout_rejects_active_stripe_subscription(
        self, create_payment_mock
    ):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.STRIPE,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_123",
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=30),
        )

        response = self.client.post(
            "/api/payments/bkash/create/",
            {
                "plan_id": str(self.pro_plan.id),
                "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        create_payment_mock.assert_not_called()

    @patch.object(BkashService, "create_payment")
    def test_create_checkout_endpoint_is_throttled(self, create_payment_mock):
        create_payment_mock.return_value = {
            "payment_id": "payment_123",
            "bkash_url": "https://sandbox.payment/bkash/123",
            "invoice_number": "INV-123",
            "amount": self.pro_plan.bkash_price_monthly,
            "response": {"statusCode": "0000"},
        }

        with patch.object(PaymentCheckoutThrottle, "rate", "1/min"):
            first_response = self.client.post(
                "/api/payments/bkash/create/",
                {
                    "plan_id": str(self.pro_plan.id),
                    "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
                },
                format="json",
            )
            second_response = self.client.post(
                "/api/payments/bkash/create/",
                {
                    "plan_id": str(self.pro_plan.id),
                    "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
                },
                format="json",
            )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @patch.object(BkashService, "create_payment")
    def test_create_checkout_writes_audit_log(self, create_payment_mock):
        create_payment_mock.return_value = {
            "payment_id": "payment_123",
            "bkash_url": "https://sandbox.payment/bkash/123",
            "invoice_number": "INV-123",
            "amount": self.pro_plan.bkash_price_monthly,
            "response": {"statusCode": "0000"},
        }

        with self.assertLogs("audit", level="INFO") as captured:
            response = self.client.post(
                "/api/payments/bkash/create/",
                {
                    "plan_id": str(self.pro_plan.id),
                    "billing_cycle": UserSubscription.BillingCycle.MONTHLY,
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any('"event": "bkash_checkout"' in message for message in captured.output))

    @patch.object(BkashService, "verify_payment")
    def test_callback_success_activates_subscription_idempotently(
        self, verify_payment_mock
    ):
        verify_payment_mock.return_value = (
            BkashTransaction.Status.COMPLETED,
            {"trxID": "trx_123", "statusCode": "0000"},
        )
        BkashTransaction.objects.create(
            user=self.user,
            subscription=UserSubscription.objects.create(
                user=self.user,
                plan=self.free_plan,
                status=UserSubscription.Status.ACTIVE,
                billing_cycle=UserSubscription.BillingCycle.MONTHLY,
                payment_provider=UserSubscription.PaymentProvider.NONE,
            ),
            target_plan=self.pro_plan,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_id="payment_123",
            invoice_number="INV-123",
            amount=self.pro_plan.bkash_price_monthly,
        )

        first_response = self.public_client.get(
            "/api/payments/bkash/callback/",
            {"paymentID": "payment_123", "status": "success"},
        )
        second_response = self.public_client.get(
            "/api/payments/bkash/callback/",
            {"paymentID": "payment_123", "status": "success"},
        )

        subscription = UserSubscription.objects.get(user=self.user)
        transaction_record = BkashTransaction.objects.get(payment_id="payment_123")

        self.assertEqual(first_response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(second_response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(subscription.plan, self.pro_plan)
        self.assertEqual(
            subscription.payment_provider, UserSubscription.PaymentProvider.BKASH
        )
        self.assertEqual(transaction_record.status, BkashTransaction.Status.COMPLETED)
        self.assertEqual(transaction_record.trx_id, "trx_123")
        self.assertEqual(verify_payment_mock.call_count, 1)

    def test_callback_cancel_does_not_change_subscription_access(self):
        BkashTransaction.objects.create(
            user=self.user,
            target_plan=self.pro_plan,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_id="payment_cancelled",
            invoice_number="INV-CANCELLED",
            amount=self.pro_plan.bkash_price_monthly,
        )

        response = self.public_client.get(
            "/api/payments/bkash/callback/",
            {"paymentID": "payment_cancelled", "status": "cancel"},
        )

        transaction_record = BkashTransaction.objects.get(
            payment_id="payment_cancelled"
        )
        subscription = UserSubscription.objects.get(user=self.user)

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/payment/failed", response.url)
        self.assertEqual(transaction_record.status, BkashTransaction.Status.CANCELLED)
        self.assertEqual(subscription.plan, self.free_plan)

    @override_settings(BKASH_CALLBACK_TRUSTED_IPS=["203.0.113.10"])
    @patch.object(BkashService, "sync_transaction")
    def test_callback_rejects_non_allowlisted_source_without_sync(
        self, sync_transaction_mock
    ):
        response = self.public_client.get(
            "/api/payments/bkash/callback/",
            {"paymentID": "payment_blocked", "status": "success"},
            REMOTE_ADDR="198.51.100.42",
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/payment/failed", response.url)
        sync_transaction_mock.assert_not_called()

    @override_settings(BKASH_CALLBACK_TRUSTED_IPS=["203.0.113.10"])
    @patch.object(BkashService, "sync_transaction")
    def test_callback_accepts_allowlisted_source(
        self, sync_transaction_mock
    ):
        response = self.public_client.get(
            "/api/payments/bkash/callback/",
            {"paymentID": "payment_allowed", "status": "success"},
            REMOTE_ADDR="203.0.113.10",
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        sync_transaction_mock.assert_called_once()

    @patch.object(BkashService, "sync_transaction", side_effect=Exception("boom"))
    def test_callback_unexpected_error_still_redirects_to_failure_page(
        self, sync_transaction_mock
    ):
        response = self.public_client.get(
            "/api/payments/bkash/callback/",
            {"paymentID": "payment_any", "status": "failure"},
        )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/payment/failed", response.url)
        sync_transaction_mock.assert_called_once()

    @patch.object(BkashService, "sync_transaction")
    def test_callback_logs_when_allowlist_is_unconfigured(self, sync_transaction_mock):
        with self.assertLogs("audit", level="WARNING") as captured:
            response = self.public_client.get(
                "/api/payments/bkash/callback/",
                {"paymentID": "payment_any", "status": "success"},
            )

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertTrue(
            any(
                '"event": "bkash_callback_allowlist_unconfigured"' in message
                for message in captured.output
            )
        )

    @patch("subscriptions.bkash_views.confirm_sns_subscription")
    @patch("subscriptions.bkash_views.verify_sns_message_signature")
    @patch("subscriptions.bkash_views.parse_sns_message")
    def test_webhook_handles_subscription_confirmation(
        self,
        parse_sns_message_mock,
        verify_signature_mock,
        confirm_subscription_mock,
    ):
        parse_sns_message_mock.return_value = {
            "Type": "SubscriptionConfirmation",
            "TopicArn": "arn:aws:sns:ap-southeast-1:123456789012:bkash",
            "MessageId": "msg-123",
            "SubscribeURL": "https://sns.ap-southeast-1.amazonaws.com/confirm",
        }

        response = self.public_client.post(
            "/api/payments/bkash/webhook/",
            data="{}",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        verify_signature_mock.assert_called_once()
        confirm_subscription_mock.assert_called_once()

    @patch("subscriptions.bkash_views.process_bkash_webhook_notification.delay")
    @patch("subscriptions.bkash_views.extract_notification_payload")
    @patch("subscriptions.bkash_views.verify_sns_message_signature")
    @patch("subscriptions.bkash_views.parse_sns_message")
    def test_webhook_notification_queues_sync_for_matching_payment(
        self,
        parse_sns_message_mock,
        verify_signature_mock,
        extract_notification_payload_mock,
        webhook_delay_mock,
    ):
        BkashTransaction.objects.create(
            user=self.user,
            target_plan=self.pro_plan,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_id="payment_webhook",
            invoice_number="INV-WEBHOOK",
            amount=self.pro_plan.bkash_price_monthly,
        )
        parse_sns_message_mock.return_value = {
            "Type": "Notification",
            "TopicArn": "arn:aws:sns:ap-southeast-1:123456789012:bkash",
            "MessageId": "msg-456",
        }
        extract_notification_payload_mock.return_value = {
            "paymentID": "payment_webhook",
            "trxID": "trx_webhook",
            "transactionStatus": "Completed",
        }

        response = self.public_client.post(
            "/api/payments/bkash/webhook/",
            data="{}",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        verify_signature_mock.assert_called_once()
        webhook_delay_mock.assert_called_once_with(
            payment_id="payment_webhook",
            status_hint=BkashTransaction.Status.COMPLETED,
        )

    @patch.object(BkashService, "search_transaction")
    @patch("subscriptions.bkash_views.process_bkash_webhook_notification.delay")
    @patch("subscriptions.bkash_views.extract_notification_payload")
    @patch("subscriptions.bkash_views.verify_sns_message_signature")
    @patch("subscriptions.bkash_views.parse_sns_message")
    def test_webhook_uses_search_transaction_when_only_trx_id_is_present(
        self,
        parse_sns_message_mock,
        verify_signature_mock,
        extract_notification_payload_mock,
        webhook_delay_mock,
        search_transaction_mock,
    ):
        BkashTransaction.objects.create(
            user=self.user,
            target_plan=self.pro_plan,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_id="payment_search",
            invoice_number="INV-SEARCH",
            amount=self.pro_plan.bkash_price_monthly,
        )
        parse_sns_message_mock.return_value = {
            "Type": "Notification",
            "TopicArn": "arn:aws:sns:ap-southeast-1:123456789012:bkash",
            "MessageId": "msg-789",
        }
        extract_notification_payload_mock.return_value = {
            "trxID": "trx_search",
            "transactionStatus": "Completed",
        }
        search_transaction_mock.return_value = {
            "paymentID": "payment_search",
            "trxID": "trx_search",
            "merchantInvoiceNumber": "INV-SEARCH",
        }

        response = self.public_client.post(
            "/api/payments/bkash/webhook/",
            data="{}",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        verify_signature_mock.assert_called_once()
        search_transaction_mock.assert_called_once_with("trx_search")
        webhook_delay_mock.assert_called_once_with(
            payment_id="payment_search",
            status_hint=BkashTransaction.Status.COMPLETED,
        )

    def test_status_endpoint_is_owner_only(self):
        BkashTransaction.objects.create(
            user=self.user,
            target_plan=self.pro_plan,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_id="payment_owner_only",
            invoice_number="INV-OWNER",
            amount=self.pro_plan.bkash_price_monthly,
        )
        other_client = APIClient()
        other_client.force_authenticate(self.other_user)

        response = other_client.get("/api/payments/bkash/status/payment_owner_only/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch.object(BkashService, "sync_transaction")
    def test_status_endpoint_is_throttled(self, sync_transaction_mock):
        transaction_record = BkashTransaction.objects.create(
            user=self.user,
            target_plan=self.pro_plan,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_id="payment_status",
            invoice_number="INV-STATUS",
            amount=self.pro_plan.bkash_price_monthly,
        )
        sync_transaction_mock.return_value = transaction_record

        with patch.object(PaymentStatusThrottle, "rate", "1/min"):
            first_response = self.client.get("/api/payments/bkash/status/payment_status/")
            second_response = self.client.get("/api/payments/bkash/status/payment_status/")

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_cancel_endpoint_flags_bkash_subscription_for_period_end(self):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.BKASH,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=20),
        )

        response = self.client.post("/api/subscription/cancel/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        subscription = UserSubscription.objects.get(user=self.user)
        self.assertTrue(subscription.cancel_at_period_end)
        self.assertIsNotNone(subscription.cancel_requested_at)
        self.assertTrue(
            SubscriptionEvent.objects.filter(
                user=self.user,
                event_type=SubscriptionEvent.EventType.BKASH_CANCEL_REQUESTED,
            ).exists()
        )

    def test_cancel_endpoint_rejects_stripe_subscription(self):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.STRIPE,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_123",
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=20),
        )

        response = self.client.post("/api/subscription/cancel/")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_check_expiring_subscriptions_sends_reminder_email(self):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.BKASH,
            current_period_start=timezone.now() - timedelta(days=25),
            current_period_end=timezone.now() + timedelta(days=2),
        )

        sent_count = check_expiring_subscriptions()

        self.assertEqual(sent_count, 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("expires soon", mail.outbox[0].subject)

    def test_check_expired_subscriptions_downgrades_after_grace_period(self):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.BKASH,
            current_period_start=timezone.now() - timedelta(days=40),
            current_period_end=timezone.now() - timedelta(days=4),
        )

        downgraded_count = check_expired_subscriptions()

        subscription = UserSubscription.objects.get(user=self.user)
        self.assertEqual(downgraded_count, 1)
        self.assertEqual(subscription.plan, self.free_plan)
        self.assertEqual(
            subscription.payment_provider, UserSubscription.PaymentProvider.NONE
        )
        self.assertEqual(len(mail.outbox), 1)

    @patch.object(BkashService, "_authorized_request")
    def test_refund_payment_records_completed_refund_and_downgrades_subscription(
        self, authorized_request_mock
    ):
        subscription = UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.BKASH,
            current_period_start=timezone.now() - timedelta(days=2),
            current_period_end=timezone.now() + timedelta(days=28),
        )
        transaction_record = BkashTransaction.objects.create(
            user=self.user,
            subscription=subscription,
            target_plan=self.pro_plan,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_id="payment_refund",
            trx_id="trx_refund",
            invoice_number="INV-REFUND",
            amount=Decimal("2900.00"),
            currency="BDT",
            status=BkashTransaction.Status.COMPLETED,
        )
        authorized_request_mock.return_value = {
            "statusCode": "0000",
            "refundTrxID": "refund_trx_123",
        }

        refunded_transaction = BkashService.refund_payment(
            "payment_refund",
            amount=Decimal("2900.00"),
            reason="Customer request",
            sku="INV-REFUND",
        )

        subscription.refresh_from_db()
        transaction_record.refresh_from_db()
        self.assertEqual(
            refunded_transaction.refund_status,
            BkashTransaction.RefundStatus.COMPLETED,
        )
        self.assertEqual(transaction_record.refund_trx_id, "refund_trx_123")
        self.assertEqual(subscription.plan, self.free_plan)
        self.assertTrue(
            SubscriptionEvent.objects.filter(
                user=self.user,
                event_type=SubscriptionEvent.EventType.BKASH_REFUNDED,
            ).exists()
        )

    @patch.object(BkashService, "query_payment")
    def test_expire_stale_bkash_transactions_marks_unresolved_transactions_expired(
        self, query_payment_mock
    ):
        transaction_record = BkashTransaction.objects.create(
            user=self.user,
            target_plan=self.pro_plan,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_id="payment_stale",
            invoice_number="INV-STALE",
            amount=self.pro_plan.bkash_price_monthly,
            created_at=timezone.now() - timedelta(hours=25),
        )
        BkashTransaction.objects.filter(pk=transaction_record.pk).update(
            created_at=timezone.now() - timedelta(hours=25)
        )
        query_payment_mock.return_value = {
            "statusCode": "2062",
            "statusMessage": "Payment expired",
            "transactionStatus": "Expired",
        }

        expired_count = expire_stale_bkash_transactions()

        transaction_record.refresh_from_db()
        self.assertEqual(expired_count, 1)
        self.assertEqual(transaction_record.status, BkashTransaction.Status.EXPIRED)


class SubscriptionEventMigrationTestCase(TransactionTestCase):
    migrate_from = [("subscriptions", "0002_usersubscription_cancel_at_period_end_and_more")]
    migrate_to = [("subscriptions", "0003_subscriptionevent")]

    def test_existing_subscriptions_get_baseline_events(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)

        old_apps = executor.loader.project_state(self.migrate_from).apps
        UserModel = old_apps.get_model("accounts", "User")
        PlanModel = old_apps.get_model("subscriptions", "Plan")
        UserSubscriptionModel = old_apps.get_model("subscriptions", "UserSubscription")

        user = UserModel.objects.create(
            username="legacy-subscription-user",
            email="legacy-subscription@example.com",
            password="password",
        )
        plan = PlanModel.objects.create(
            name="Legacy Pro",
            slug="legacy-pro",
            tier=999,
            max_surveys=50,
            max_questions_per_survey=50,
            max_responses_per_survey=500,
            price_monthly="29.00",
            price_yearly="290.00",
            bkash_price_monthly="2500.00",
            bkash_price_yearly="25000.00",
            currency="USD",
            is_active=True,
            features=[],
        )
        UserSubscriptionModel.objects.create(
            user_id=user.pk,
            plan_id=plan.pk,
            status="active",
            billing_cycle="monthly",
            payment_provider="none",
        )

        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(self.migrate_to)

        migrated_apps = executor.loader.project_state(self.migrate_to).apps
        SubscriptionEventModel = migrated_apps.get_model(
            "subscriptions", "SubscriptionEvent"
        )

        self.assertTrue(
            SubscriptionEventModel.objects.filter(event_type="baseline").exists()
        )
