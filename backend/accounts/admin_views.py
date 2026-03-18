import csv

from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from subscriptions.admin_services import AdminPaymentsService
from subscriptions.models import Plan, SubscriptionEvent
from subscriptions.services import LicenseService

from .admin_serializers import (
    AITestRequestSerializer,
    AdminSubscriptionSummarySerializer,
    AdminUserDetailSerializer,
    AdminUserListSerializer,
    AdminUserUpdateSerializer,
    SiteSettingsAdminSerializer,
    SiteSettingsUpdateSerializer,
    SubscriptionEventSerializer,
)
from .ai_testing import AITestConnectionError, AITestService
from .models import SiteSettings
from .password_reset import send_password_reset_email

User = get_user_model()


class IsSuperuserPermission(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_superuser
        )


class AdminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def get_site_settings():
    settings_obj, _ = SiteSettings.objects.get_or_create(pk=1)
    return settings_obj


def parse_datetime_filter(value, *, end_of_day=False):
    if not value:
        return None
    try:
        parsed = timezone.datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    if end_of_day:
        return parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    return parsed


class AdminDashboardView(APIView):
    permission_classes = [IsSuperuserPermission]

    def get(self, request):
        return Response(AdminPaymentsService.build_dashboard_payload())


class AdminUsersView(APIView):
    permission_classes = [IsSuperuserPermission]
    pagination_class = AdminPagination

    def get_queryset(self, request):
        queryset = User.objects.select_related("subscription__plan").annotate(
            survey_count=Count("surveys", distinct=True),
            response_count=Count(
                "surveys__responses",
                filter=Q(surveys__responses__status="completed"),
                distinct=True,
            ),
        )

        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        plan_slug = (request.query_params.get("plan") or "").strip()
        if plan_slug:
            queryset = queryset.filter(subscription__plan__slug=plan_slug)

        is_active = (request.query_params.get("is_active") or "").strip().lower()
        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=(is_active == "true"))

        ordering = (request.query_params.get("ordering") or "-created_at").strip()
        ordering_map = {
            "created_at": "created_at",
            "-created_at": "-created_at",
            "last_login": "last_login",
            "-last_login": "-last_login",
            "username": "username",
            "-username": "-username",
            "email": "email",
            "-email": "-email",
            "survey_count": "survey_count",
            "-survey_count": "-survey_count",
            "response_count": "response_count",
            "-response_count": "-response_count",
        }
        return queryset.order_by(ordering_map.get(ordering, "-created_at"))

    def get(self, request):
        queryset = self.get_queryset(request)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = AdminUserListSerializer(page, many=True)
        return Response(
            {
                "count": paginator.page.paginator.count,
                "next": paginator.get_next_link(),
                "previous": paginator.get_previous_link(),
                "results": serializer.data,
                "plans": AdminPaymentsService.get_plans_for_admin(),
            }
        )


class AdminUserDetailView(APIView):
    permission_classes = [IsSuperuserPermission]

    def get_user(self, user_id):
        return get_object_or_404(
            User.objects.select_related("subscription__plan"),
            pk=user_id,
        )

    def get(self, request, user_id):
        user = self.get_user(user_id)
        detail = AdminPaymentsService.build_user_detail_snapshot(user)
        events = SubscriptionEvent.objects.filter(user=user).select_related("plan")[:10]

        return Response(
            {
                "user": AdminUserDetailSerializer(user).data,
                "subscription": AdminSubscriptionSummarySerializer(
                    detail["subscription"]
                ).data,
                "usage": detail["usage"],
                "recent_surveys": detail["recent_surveys"],
                "recent_payments": detail["recent_payments"],
                "payment_warnings": detail["payment_warnings"],
                "subscription_events": SubscriptionEventSerializer(
                    events, many=True
                ).data,
                "plans": AdminPaymentsService.get_plans_for_admin(),
            }
        )

    def patch(self, request, user_id):
        serializer = AdminUserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_user = self.get_user(user_id)
        validated = serializer.validated_data

        with transaction.atomic():
            locked_user = User.objects.select_for_update().get(pk=target_user.pk)
            subscription = LicenseService.get_user_subscription(
                locked_user, for_update=True
            )

            if "is_active" in validated:
                next_is_active = validated["is_active"]
                if locked_user.pk == request.user.pk and not next_is_active:
                    return Response(
                        {"detail": "You cannot deactivate your own account."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if (
                    locked_user.is_superuser
                    and locked_user.is_active
                    and not next_is_active
                    and User.objects.filter(is_superuser=True, is_active=True).count() <= 1
                ):
                    return Response(
                        {
                            "detail": "Questiz must keep at least one active superuser account."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                locked_user.is_active = next_is_active
                locked_user.save(update_fields=["is_active"])

            if "plan_id" in validated:
                plan = get_object_or_404(Plan.objects.filter(is_active=True), pk=validated["plan_id"])
                if (
                    subscription.payment_provider
                    == subscription.PaymentProvider.STRIPE
                    and LicenseService.is_subscription_paid_and_active(subscription)
                ):
                    return Response(
                        {
                            "detail": "Active Stripe-managed subscriptions must be changed from the Stripe billing portal."
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                previous_state = LicenseService.serialize_subscription_state(subscription)
                subscription.plan = plan
                subscription.status = subscription.Status.ACTIVE
                subscription.payment_provider = subscription.PaymentProvider.NONE
                if not subscription.billing_cycle:
                    subscription.billing_cycle = subscription.BillingCycle.MONTHLY
                subscription.cancel_at_period_end = False
                subscription.cancel_requested_at = None
                subscription.stripe_customer_id = None
                subscription.stripe_subscription_id = None
                subscription.bkash_subscription_id = None
                subscription.current_period_start = None
                subscription.current_period_end = None
                subscription.save()
                LicenseService.record_subscription_event(
                    subscription,
                    SubscriptionEvent.EventType.ADMIN_OVERRIDE,
                    metadata={
                        "actor_user_id": str(request.user.id),
                        "previous_state": previous_state,
                    },
                )

        refreshed_user = self.get_user(user_id)
        detail = AdminPaymentsService.build_user_detail_snapshot(refreshed_user)
        events = SubscriptionEvent.objects.filter(user=refreshed_user).select_related(
            "plan"
        )[:10]
        return Response(
            {
                "user": AdminUserDetailSerializer(refreshed_user).data,
                "subscription": AdminSubscriptionSummarySerializer(
                    detail["subscription"]
                ).data,
                "usage": detail["usage"],
                "recent_surveys": detail["recent_surveys"],
                "recent_payments": detail["recent_payments"],
                "payment_warnings": detail["payment_warnings"],
                "subscription_events": SubscriptionEventSerializer(
                    events, many=True
                ).data,
            }
        )


class AdminSendPasswordResetView(APIView):
    permission_classes = [IsSuperuserPermission]

    def post(self, request, user_id):
        target_user = get_object_or_404(User, pk=user_id, is_active=True)
        try:
            send_password_reset_email(target_user, requested_by=request.user)
        except ImproperlyConfigured as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {"detail": "Password reset email sent successfully."},
            status=status.HTTP_200_OK,
        )


class AdminPaymentsView(APIView):
    permission_classes = [IsSuperuserPermission]
    pagination_class = AdminPagination

    def get_payment_data(self, request):
        return AdminPaymentsService.list_payments(
            provider=(request.query_params.get("provider") or "").strip(),
            status=(request.query_params.get("status") or "").strip(),
            user_id=(request.query_params.get("user_id") or "").strip(),
            date_from=parse_datetime_filter(request.query_params.get("date_from")),
            date_to=parse_datetime_filter(
                request.query_params.get("date_to"), end_of_day=True
            ),
            search=(request.query_params.get("search") or "").strip(),
            ordering=(request.query_params.get("ordering") or "-created_at").strip(),
        )

    def get(self, request):
        payment_data = self.get_payment_data(request)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(payment_data["payments"], request)
        return Response(
            {
                "count": paginator.page.paginator.count,
                "next": paginator.get_next_link(),
                "previous": paginator.get_previous_link(),
                "results": page,
                "revenue_totals": payment_data["revenue_totals"],
                "warnings": payment_data["warnings"],
            }
        )


class AdminPaymentsExportView(AdminPaymentsView):
    def get(self, request):
        payment_data = self.get_payment_data(request)
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="questiz-payments.csv"'

        writer = csv.writer(response)
        writer.writerow(
            [
                "provider",
                "provider_reference",
                "invoice_number",
                "status",
                "amount",
                "currency",
                "billing_cycle",
                "plan",
                "username",
                "email",
                "created_at",
            ]
        )
        for payment in payment_data["payments"]:
            writer.writerow(
                [
                    payment.get("provider", ""),
                    payment.get("provider_reference", ""),
                    payment.get("invoice_number", ""),
                    payment.get("status", ""),
                    payment.get("amount", ""),
                    payment.get("currency", ""),
                    payment.get("billing_cycle", ""),
                    payment.get("plan", {}).get("name", ""),
                    payment.get("user", {}).get("username", ""),
                    payment.get("user", {}).get("email", ""),
                    payment.get("created_at", ""),
                ]
            )
        return response


class AdminSettingsView(APIView):
    permission_classes = [IsSuperuserPermission]

    def get(self, request):
        return Response(SiteSettingsAdminSerializer(get_site_settings()).data)

    def patch(self, request):
        serializer = SiteSettingsUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        settings_obj = get_site_settings()
        for field, value in serializer.validated_data.items():
            if field.startswith("ai_api_key_"):
                if value:
                    setattr(settings_obj, field, value)
                continue
            setattr(settings_obj, field, value)
        settings_obj.save()
        return Response(SiteSettingsAdminSerializer(settings_obj).data)


class AdminSettingsTestAIView(APIView):
    permission_classes = [IsSuperuserPermission]

    def post(self, request):
        settings_obj = get_site_settings()
        payload = {
            "provider": request.data.get("provider") or settings_obj.ai_provider,
            "model": request.data.get("model")
            or (
                settings_obj.ai_model_openai
                if (request.data.get("provider") or settings_obj.ai_provider)
                == SiteSettings.AIProvider.OPENAI
                else settings_obj.ai_model_anthropic
            ),
            "api_key": request.data.get("api_key")
            or (
                settings_obj.ai_api_key_openai
                if (request.data.get("provider") or settings_obj.ai_provider)
                == SiteSettings.AIProvider.OPENAI
                else settings_obj.ai_api_key_anthropic
            ),
        }
        serializer = AITestRequestSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        try:
            result = AITestService.test_connection(**serializer.validated_data)
        except AITestConnectionError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(result, status=status.HTTP_200_OK)
