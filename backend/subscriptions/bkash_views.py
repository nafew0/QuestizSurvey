import logging

from django.db import transaction
from django.shortcuts import get_object_or_404, redirect
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .bkash_service import (
    BkashCheckoutConflictError,
    BkashConfigurationError,
    BkashService,
    BkashServiceError,
    BkashUserInputError,
)
from .models import BkashTransaction, Plan
from .serializers import BkashCheckoutSessionSerializer, BkashTransactionSerializer
from .services import LicenseService

logger = logging.getLogger(__name__)


def _map_callback_status(value):
    normalized = str(value or "").strip().lower()
    if normalized == "cancel":
        return BkashTransaction.Status.CANCELLED
    if normalized == "expired":
        return BkashTransaction.Status.EXPIRED
    return BkashTransaction.Status.FAILED


def _safe_redirect(url_builder, *, status_value="failed"):
    try:
        if status_value == "success":
            return redirect(url_builder())
        return redirect(url_builder(status_value=status_value))
    except Exception:  # pragma: no cover - last-resort fallback for callback UX
        logger.exception("Could not build the Questiz bKash callback redirect URL.")
        return redirect("/payment/failed")


class BkashCheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = BkashCheckoutSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        plan = get_object_or_404(
            Plan.objects.filter(is_active=True),
            pk=serializer.validated_data["plan_id"],
        )
        billing_cycle = serializer.validated_data["billing_cycle"]

        if plan.slug == LicenseService.FREE_PLAN_SLUG:
            return Response(
                {"detail": "The Free plan does not require bKash checkout."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if LicenseService.get_bkash_amount_for_plan(plan, billing_cycle) <= 0:
            return Response(
                {
                    "detail": f"The BDT price for the {plan.name} {billing_cycle} plan is not configured yet."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            subscription = LicenseService.get_user_subscription(
                request.user,
                for_update=True,
            )
            validation = LicenseService.validate_bkash_checkout_request(
                subscription,
                plan,
                billing_cycle,
            )
            if not validation.allowed:
                return Response(
                    {"detail": validation.message},
                    status=status.HTTP_409_CONFLICT,
                )

        try:
            payment_session = BkashService.create_payment(
                request.user,
                plan,
                billing_cycle,
            )
        except BkashCheckoutConflictError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )
        except BkashConfigurationError as exc:
            return Response(
                {"detail": str(exc), "code": "bkash_not_configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except BkashUserInputError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except BkashServiceError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        with transaction.atomic():
            subscription = LicenseService.get_user_subscription(
                request.user,
                for_update=True,
            )
            validation = LicenseService.validate_bkash_checkout_request(
                subscription,
                plan,
                billing_cycle,
            )
            if not validation.allowed:
                logger.warning(
                    "bKash checkout session orphaned by state change for user=%s plan=%s",
                    request.user.pk,
                    plan.pk,
                )
                return Response(
                    {"detail": validation.message},
                    status=status.HTTP_409_CONFLICT,
                )

            BkashTransaction.objects.create(
                user=request.user,
                subscription=subscription,
                target_plan=plan,
                billing_cycle=billing_cycle,
                payment_id=payment_session["payment_id"],
                invoice_number=payment_session["invoice_number"],
                amount=payment_session["amount"],
                currency="BDT",
                status=BkashTransaction.Status.INITIATED,
                bkash_response=payment_session["response"],
            )

        return Response(
            {
                "bkash_url": payment_session["bkash_url"],
                "payment_id": payment_session["payment_id"],
            },
            status=status.HTTP_200_OK,
        )


def bkash_callback_view(request):
    payment_id = (request.GET.get("paymentID") or "").strip()
    status_value = (request.GET.get("status") or "").strip().lower()

    try:
        if not payment_id:
            return _safe_redirect(
                BkashService.build_failure_redirect_url,
                status_value="failed",
            )

        if status_value == "success":
            BkashService.sync_transaction(
                payment_id,
                status_hint=BkashTransaction.Status.COMPLETED,
            )
            return _safe_redirect(
                BkashService.build_success_redirect_url,
                status_value="success",
            )

        BkashService.sync_transaction(
            payment_id,
            status_hint=_map_callback_status(status_value),
        )
        return _safe_redirect(
            BkashService.build_failure_redirect_url,
            status_value=status_value,
        )
    except BkashUserInputError:
        logger.warning(
            "bKash callback referenced an unknown payment ID.", exc_info=True
        )
    except BkashConfigurationError:
        logger.exception("bKash callback received before the gateway was configured.")
    except BkashServiceError:
        logger.exception("bKash callback processing failed.")
    except Exception:
        logger.exception("Unexpected bKash callback failure.")

    return _safe_redirect(
        BkashService.build_failure_redirect_url,
        status_value="failed",
    )


class BkashPaymentStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        transaction_record = get_object_or_404(
            BkashTransaction.objects.select_related("target_plan"),
            payment_id=payment_id,
            user=request.user,
        )

        provider_status = transaction_record.bkash_response
        if transaction_record.status == BkashTransaction.Status.INITIATED:
            try:
                transaction_record = BkashService.sync_transaction(payment_id)
                provider_status = transaction_record.bkash_response
            except BkashConfigurationError as exc:
                return Response(
                    {
                        "transaction": BkashTransactionSerializer(
                            transaction_record
                        ).data,
                        "provider_status": provider_status,
                        "provider_status_unavailable": True,
                        "detail": str(exc),
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except BkashServiceError as exc:
                return Response(
                    {
                        "transaction": BkashTransactionSerializer(
                            transaction_record
                        ).data,
                        "provider_status": provider_status,
                        "provider_status_unavailable": True,
                        "detail": str(exc),
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        return Response(
            {
                "transaction": BkashTransactionSerializer(transaction_record).data,
                "provider_status": provider_status,
            },
            status=status.HTTP_200_OK,
        )
