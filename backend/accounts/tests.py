from datetime import timedelta
from decimal import Decimal
import re
from unittest.mock import patch

from django.conf import settings
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.admin.sites import AdminSite
from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.test.client import RequestFactory
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.migrations.executor import MigrationExecutor
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .admin import EmailVerificationTokenAdmin
from .ai_testing import AITestService
from .models import EmailVerificationToken, SiteSettings
from .verification import send_verification_email
from subscriptions.admin_services import StripePaymentsResult
from subscriptions.models import BkashTransaction, Plan, SubscriptionEvent, UserSubscription

User = get_user_model()

TEST_CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    PUBLIC_APP_URL="http://localhost:5555",
    CACHES=TEST_CACHES,
)
class AccountsAuthFlowTestCase(TestCase):
    """Production-oriented auth and verification coverage."""

    def setUp(self):
        self.client = APIClient()
        self.register_url = "/api/auth/register/"
        self.login_url = "/api/auth/login/"
        self.refresh_url = "/api/auth/token/refresh/"
        self.get_user_url = "/api/auth/user/"
        self.update_url = "/api/auth/user/update/"
        self.send_verification_url = "/api/auth/send-verification-email/"
        self.resend_verification_url = "/api/auth/resend-verification-email/"
        self.verify_email_url = "/api/auth/verify-email/"
        self.password_reset_request_url = "/api/auth/password-reset/request/"
        self.set_verification_required(True)

    def set_verification_required(self, enabled):
        SiteSettings.objects.update_or_create(
            pk=1,
            defaults={
                "require_email_verification": enabled,
                "logged_in_users_only_default": False,
                "ai_provider": "openai",
                "ai_api_key_openai": "",
                "ai_api_key_anthropic": "",
            },
        )

    def create_user(self, **overrides):
        payload = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "TestPass123!",
            "email_verified": True,
        }
        payload.update(overrides)
        return User.objects.create_user(**payload)

    def test_user_registration_requires_email_verification_when_enabled(self):
        data = {
            "username": "newuser",
            "email": "new@example.com",
            "password": "TestPass123!",
            "password2": "TestPass123!",
            "first_name": "New",
            "last_name": "User",
        }

        response = self.client.post(self.register_url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("tokens", response.data)
        self.assertNotIn("access_token", response.data)
        self.assertTrue(response.data["email_verification_required"])
        self.assertEqual(response.data["user"]["email_verified"], False)

        user = User.objects.get(username="newuser")
        self.assertFalse(user.email_verified)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("http://localhost:5555/verify-email?token=", mail.outbox[0].body)
        self.assertTrue(mail.outbox[0].alternatives)
        self.assertIn("http://localhost:5555/verify-email?token=", mail.outbox[0].alternatives[0][0])

    def test_user_registration_returns_tokens_when_verification_disabled(self):
        self.set_verification_required(False)
        data = {
            "username": "openuser",
            "email": "open@example.com",
            "password": "TestPass123!",
            "password2": "TestPass123!",
        }

        response = self.client.post(self.register_url, data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["email_verification_required"])
        self.assertIn("access_token", response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, response.cookies)
        self.assertTrue(User.objects.get(username="openuser").email_verified)
        self.assertEqual(len(mail.outbox), 0)

    def test_user_registration_password_mismatch(self):
        response = self.client.post(
            self.register_url,
            {
                "username": "baduser",
                "email": "bad@example.com",
                "password": "TestPass123!",
                "password2": "DifferentPass123!",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_login_success(self):
        self.create_user()

        response = self.client.post(
            self.login_url,
            {"username": "testuser", "password": "TestPass123!"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, response.cookies)
        self.assertIn("user", response.data)

    def test_user_login_success_with_email(self):
        self.create_user()

        response = self.client.post(
            self.login_url,
            {"username": "test@example.com", "password": "TestPass123!"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "testuser")

    def test_superuser_login_success(self):
        admin = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="AdminPass123!",
            email_verified=True,
        )

        response = self.client.post(
            self.login_url,
            {"username": admin.username, "password": "AdminPass123!"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["user"]["is_staff"])

    def test_user_login_invalid_credentials(self):
        self.create_user()

        response = self.client.post(
            self.login_url,
            {"username": "testuser", "password": "WrongPassword"},
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_login_requires_email_verification_when_enabled(self):
        self.create_user(username="needsverify", email="needsverify@example.com", email_verified=False)

        response = self.client.post(
            self.login_url,
            {"username": "needsverify", "password": "TestPass123!"},
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(response.data["email_verification_required"])
        self.assertIn("email_hint", response.data)

    def test_refresh_denies_unverified_user_when_required(self):
        user = self.create_user(username="refreshuser", email="refresh@example.com", email_verified=False)
        refresh = RefreshToken.for_user(user)

        response = self.client.post(
            self.refresh_url,
            {"refresh": str(refresh)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(response.data["email_verification_required"])

    def test_send_verification_email_requires_cooldown(self):
        user = self.create_user(username="resenduser", email="resend@example.com", email_verified=False)
        self.client.force_authenticate(user=user)

        first_response = self.client.post(self.send_verification_url)
        second_response = self.client.post(self.send_verification_url)

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertGreater(second_response.data["retry_after_seconds"], 0)
        self.assertEqual(len(mail.outbox), 1)

    def test_public_resend_is_generic_and_only_sends_for_eligible_users(self):
        self.create_user(username="verifyme", email="verifyme@example.com", email_verified=False)

        missing_response = self.client.post(
            self.resend_verification_url,
            {"identifier": "missing@example.com"},
            format="json",
        )
        self.assertEqual(missing_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

        existing_response = self.client.post(
            self.resend_verification_url,
            {"identifier": "verifyme@example.com"},
            format="json",
        )

        self.assertEqual(existing_response.status_code, status.HTTP_200_OK)
        self.assertEqual(existing_response.data, missing_response.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_verify_email_success_and_idempotent(self):
        user = self.create_user(username="verifytoken", email="verifytoken@example.com", email_verified=False)
        token = send_verification_email(user)

        first_response = self.client.get(self.verify_email_url, {"token": token.token})
        second_response = self.client.get(self.verify_email_url, {"token": token.token})

        user.refresh_from_db()
        token.refresh_from_db()

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertTrue(user.email_verified)
        self.assertTrue(token.used)

    def test_verify_email_rejects_invalid_or_expired_token(self):
        user = self.create_user(username="expireduser", email="expired@example.com", email_verified=False)
        expired_token = EmailVerificationToken.objects.create(
            user=user,
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        missing_response = self.client.get(self.verify_email_url, {"token": "a" * 64})
        expired_response = self.client.get(self.verify_email_url, {"token": expired_token.token})

        self.assertEqual(missing_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(expired_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_public_password_reset_request_is_generic_and_sends_when_eligible(self):
        self.create_user(username="resetme", email="resetme@example.com")

        missing_response = self.client.post(
            self.password_reset_request_url,
            {"identifier": "missing@example.com"},
            format="json",
        )
        existing_response = self.client.post(
            self.password_reset_request_url,
            {"identifier": "resetme@example.com"},
            format="json",
        )

        self.assertEqual(missing_response.status_code, status.HTTP_200_OK)
        self.assertEqual(existing_response.status_code, status.HTTP_200_OK)
        self.assertEqual(missing_response.data, existing_response.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_public_password_reset_request_respects_cooldown_without_enumeration(self):
        self.create_user(username="cooldownuser", email="cooldown@example.com")

        first_response = self.client.post(
            self.password_reset_request_url,
            {"identifier": "cooldown@example.com"},
            format="json",
        )
        second_response = self.client.post(
            self.password_reset_request_url,
            {"identifier": "cooldown@example.com"},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(first_response.data, second_response.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_get_user_includes_extended_profile_and_email_verification_fields(self):
        user = self.create_user(
            username="profileuser",
            email="profile@example.com",
            first_name="Ava",
            last_name="Stone",
            organization="Questiz Labs",
            designation="Research Lead",
            phone="+1 (555) 010-9999",
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(self.get_user_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("organization", response.data)
        self.assertIn("designation", response.data)
        self.assertIn("phone", response.data)
        self.assertIn("email_verified", response.data)
        self.assertIn("current_plan", response.data)
        self.assertEqual(response.data["current_plan"]["slug"], "free")

    def test_profile_update_accepts_extended_fields(self):
        user = self.create_user(username="profileupdate", email="profileupdate@example.com")
        self.client.force_authenticate(user=user)
        payload = {
            "first_name": "Ava",
            "last_name": "Stone",
            "organization": "Questiz Labs",
            "designation": "Research Lead",
            "phone": "+1 (555) 010-9999",
            "bio": "Builds production survey systems.",
        }

        response = self.client.patch(self.update_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.organization, payload["organization"])
        self.assertEqual(user.designation, payload["designation"])
        self.assertEqual(user.phone, payload["phone"])

    def test_profile_update_rejects_invalid_phone_characters(self):
        user = self.create_user(username="badphone", email="badphone@example.com")
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            self.update_url,
            {"phone": "555-123<script>"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_profile_update_rejects_invalid_avatar_file(self):
        user = self.create_user(username="avataruser", email="avatar@example.com")
        self.client.force_authenticate(user=user)
        invalid_avatar = SimpleUploadedFile(
            "avatar.txt",
            b"not-an-image",
            content_type="text/plain",
        )

        response = self.client.patch(
            self.update_url,
            {"avatar": invalid_avatar},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("avatar", response.data)


class EmailVerificationMigrationTestCase(TransactionTestCase):
    """Ensure rollout migration marks existing users verified."""

    migrate_from = [("accounts", "0002_user_designation_user_organization_user_phone")]
    migrate_to = [("accounts", "0003_sitesettings_user_email_verified_and_more")]

    def test_existing_users_are_marked_verified_and_site_settings_is_created(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)

        old_apps = executor.loader.project_state(self.migrate_from).apps
        OldUser = old_apps.get_model("accounts", "User")
        OldUser.objects.create(
            username="legacyuser",
            email="legacy@example.com",
            password="legacy-password",
        )

        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(self.migrate_to)

        migrated_apps = executor.loader.project_state(self.migrate_to).apps
        NewUser = migrated_apps.get_model("accounts", "User")
        SiteSettingsModel = migrated_apps.get_model("accounts", "SiteSettings")

        self.assertTrue(NewUser.objects.get(username="legacyuser").email_verified)
        self.assertTrue(SiteSettingsModel.objects.filter(pk=1).exists())


class EmailVerificationTokenAdminTestCase(TestCase):
    """Admin permissions should not block cascaded user deletion."""

    def setUp(self):
        self.admin = EmailVerificationTokenAdmin(EmailVerificationToken, AdminSite())
        self.request_factory = RequestFactory()

    def test_superuser_has_delete_permission_for_verification_tokens(self):
        request = self.request_factory.get("/admin/accounts/emailverificationtoken/")
        request.user = User.objects.create_superuser(
            username="admin-perm",
            email="admin-perm@example.com",
            password="AdminPass123!",
            email_verified=True,
        )

        self.assertTrue(self.admin.has_delete_permission(request))


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    PUBLIC_APP_URL="http://localhost:5555",
    CACHES=TEST_CACHES,
    STRIPE_SECRET_KEY="sk_test_admin",
)
class AdminApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superuser = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="AdminPass123!",
            email_verified=True,
        )
        self.user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="MemberPass123!",
            first_name="Member",
            last_name="User",
            email_verified=True,
        )
        self.free_plan = Plan.objects.get(slug="free")
        self.pro_plan = Plan.objects.get(slug="pro")
        self.enterprise_plan = Plan.objects.get(slug="enterprise")

    def authenticate_admin(self):
        self.client.force_authenticate(self.superuser)

    def test_admin_endpoints_require_superuser(self):
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("accounts.admin_views.AdminPaymentsService.fetch_stripe_payments")
    def test_dashboard_returns_warning_when_stripe_is_unavailable(self, stripe_mock):
        stripe_mock.return_value = StripePaymentsResult(
            payments=[],
            warnings=["Stripe payment history is temporarily unavailable."],
        )
        self.authenticate_admin()

        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("warnings", response.data)
        self.assertTrue(response.data["warnings"])

    def test_admin_users_list_supports_search(self):
        User.objects.create_user(
            username="another",
            email="another@example.com",
            password="AnotherPass123!",
            email_verified=True,
        )
        self.authenticate_admin()

        response = self.client.get("/api/admin/users/?search=member")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["username"], "member")

    def test_admin_cannot_deactivate_self(self):
        self.authenticate_admin()

        response = self.client.patch(
            f"/api/admin/users/{self.superuser.id}/",
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.superuser.refresh_from_db()
        self.assertTrue(self.superuser.is_active)

    def test_admin_cannot_override_active_stripe_subscription(self):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.STRIPE,
            stripe_customer_id="cus_admin_123",
            stripe_subscription_id="sub_admin_123",
        )
        self.authenticate_admin()

        response = self.client.patch(
            f"/api/admin/users/{self.user.id}/",
            {"plan_id": str(self.enterprise_plan.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_admin_plan_override_records_subscription_event(self):
        UserSubscription.objects.create(
            user=self.user,
            plan=self.free_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.NONE,
        )
        self.authenticate_admin()

        response = self.client.patch(
            f"/api/admin/users/{self.user.id}/",
            {"plan_id": str(self.pro_plan.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["subscription"]["plan"]["slug"],
            self.pro_plan.slug,
        )
        self.assertTrue(
            SubscriptionEvent.objects.filter(
                user=self.user,
                event_type=SubscriptionEvent.EventType.ADMIN_OVERRIDE,
            ).exists()
        )

    @patch("accounts.admin_views.AdminPaymentsService.fetch_stripe_payments")
    def test_admin_payments_combines_sources_and_exports_csv(self, stripe_mock):
        subscription = UserSubscription.objects.create(
            user=self.user,
            plan=self.pro_plan,
            status=UserSubscription.Status.ACTIVE,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_provider=UserSubscription.PaymentProvider.BKASH,
        )
        BkashTransaction.objects.create(
            user=self.user,
            subscription=subscription,
            target_plan=self.pro_plan,
            billing_cycle=UserSubscription.BillingCycle.MONTHLY,
            payment_id="pay_bkash_1",
            invoice_number="INV-BKASH-1",
            amount=Decimal("499.00"),
            currency="BDT",
            status=BkashTransaction.Status.COMPLETED,
            bkash_response={"paymentID": "pay_bkash_1"},
        )
        stripe_mock.return_value = StripePaymentsResult(
            payments=[
                {
                    "id": "in_test",
                    "provider": "stripe",
                    "provider_reference": "in_test",
                    "invoice_number": "Q-1001",
                    "trx_id": "",
                    "status": "paid",
                    "amount": "29.00",
                    "currency": "USD",
                    "created_at": timezone.now().isoformat(),
                    "description": "Stripe invoice",
                    "billing_cycle": "monthly",
                    "user": {
                        "id": str(self.user.id),
                        "username": self.user.username,
                        "email": self.user.email,
                    },
                    "plan": {
                        "id": str(self.pro_plan.id),
                        "name": self.pro_plan.name,
                        "slug": self.pro_plan.slug,
                    },
                    "revenue_amount": 29.0,
                }
            ],
            warnings=[],
        )
        self.authenticate_admin()

        list_response = self.client.get("/api/admin/payments/")
        export_response = self.client.get("/api/admin/payments/export/")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 2)
        self.assertEqual(export_response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", export_response["Content-Type"])
        export_text = export_response.content.decode("utf-8")
        self.assertIn("INV-BKASH-1", export_text)
        self.assertIn("in_test", export_text)

    def test_admin_settings_masks_keys_and_updates_write_only_fields(self):
        SiteSettings.objects.update_or_create(
            pk=1,
            defaults={
                "require_email_verification": True,
                "logged_in_users_only_default": False,
                "ai_provider": "openai",
                "ai_model_openai": "gpt-5-mini",
                "ai_model_anthropic": "claude-3-5-haiku-latest",
                "ai_api_key_openai": "sk-test-openai-1234",
                "ai_api_key_anthropic": "sk-ant-test-5678",
            },
        )
        self.authenticate_admin()

        get_response = self.client.get("/api/admin/settings/")
        patch_response = self.client.patch(
            "/api/admin/settings/",
            {
                "ai_provider": "anthropic",
                "ai_model_anthropic": "claude-3-7-sonnet-latest",
                "ai_api_key_anthropic": "sk-ant-updated-9999",
            },
            format="json",
        )

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertTrue(get_response.data["ai_api_key_openai_meta"]["configured"])
        self.assertNotIn("sk-test-openai-1234", str(get_response.data))
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        settings_obj = SiteSettings.objects.get(pk=1)
        self.assertEqual(settings_obj.ai_provider, "anthropic")
        self.assertEqual(settings_obj.ai_api_key_anthropic, "sk-ant-updated-9999")

    @override_settings(AI_SECRETS_ALLOW_DATABASE=False)
    def test_admin_settings_rejects_ai_key_writes_when_environment_only(self):
        self.authenticate_admin()

        response = self.client.patch(
            "/api/admin/settings/",
            {"ai_api_key_openai": "sk-live-should-not-store"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("environment variables", response.data["detail"])

    @patch.object(AITestService, "test_connection")
    def test_admin_test_ai_does_not_persist_unsaved_values(self, test_connection_mock):
        SiteSettings.objects.update_or_create(
            pk=1,
            defaults={
                "require_email_verification": True,
                "logged_in_users_only_default": False,
                "ai_provider": "openai",
                "ai_model_openai": "gpt-5-mini",
                "ai_model_anthropic": "",
                "ai_api_key_openai": "sk-existing-openai",
                "ai_api_key_anthropic": "",
            },
        )
        test_connection_mock.return_value = {
            "provider": "openai",
            "model": "gpt-5",
            "message": "ok",
        }
        self.authenticate_admin()

        response = self.client.post(
            "/api/admin/settings/test-ai/",
            {
                "provider": "openai",
                "model": "gpt-5",
                "api_key": "sk-unsaved-openai",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            SiteSettings.objects.get(pk=1).ai_api_key_openai,
            "sk-existing-openai",
        )

    @patch.object(AITestService, "_request")
    def test_openai_ai_test_accepts_incomplete_status_when_text_exists(
        self,
        request_mock,
    ):
        request_mock.return_value = {
            "status": "incomplete",
            "incomplete_details": {"reason": "max_output_tokens"},
            "output_text": "OK",
        }

        result = AITestService.test_connection(
            provider="openai",
            model="gpt-5-mini",
            api_key="sk-test-openai",
        )

        self.assertEqual(result["provider"], "openai")
        self.assertIn("succeeded", result["message"])

    @patch.object(AITestService, "_request")
    def test_openai_ai_test_reads_text_from_output_array_when_output_text_missing(
        self,
        request_mock,
    ):
        request_mock.return_value = {
            "status": "completed",
            "output": [
                {
                    "type": "message",
                    "content": [
                        {"type": "output_text", "text": "OK"},
                    ],
                }
            ],
        }

        result = AITestService.test_connection(
            provider="openai",
            model="gpt-5-mini",
            api_key="sk-test-openai",
        )

        self.assertEqual(result["provider"], "openai")
        self.assertIn("succeeded", result["message"])

    def test_admin_password_reset_flow(self):
        self.authenticate_admin()

        send_response = self.client.post(
            f"/api/admin/users/{self.user.id}/send-password-reset/",
        )

        self.assertEqual(send_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        html_body = mail.outbox[0].alternatives[0][0]
        match = re.search(
            r"reset-password\?uid=(?P<uid>[^&]+)&amp;token=(?P<token>[^\"]+)",
            html_body,
        )
        self.assertIsNotNone(match)
        params = match.groupdict()

        validate_response = self.client.get(
            "/api/auth/password-reset/validate/",
            params,
        )
        confirm_response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "uid": params["uid"],
                "token": params["token"],
                "new_password": "UpdatedPass123!",
                "new_password2": "UpdatedPass123!",
            },
            format="json",
        )

        self.assertEqual(validate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(validate_response.data, {"valid": True})
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("UpdatedPass123!"))
