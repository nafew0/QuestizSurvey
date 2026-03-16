import logging

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Plan
from .serializers import StripeCheckoutSessionSerializer
from .stripe_service import (
    StripeCheckoutConflictError,
    StripeConfigurationError,
    StripeService,
    StripeServiceError,
    StripeUserInputError,
    StripeWebhookSignatureError,
)

logger = logging.getLogger(__name__)


class StripeConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from django.conf import settings

        return Response({"publishable_key": settings.STRIPE_PUBLISHABLE_KEY})


class StripeCheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = StripeCheckoutSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        plan = get_object_or_404(
            Plan.objects.filter(is_active=True),
            pk=serializer.validated_data["plan_id"],
        )

        try:
            checkout_url = StripeService.create_checkout_session(
                request.user,
                plan,
                serializer.validated_data["billing_cycle"],
            )
        except StripeCheckoutConflictError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "requires_customer_portal": exc.requires_customer_portal,
                },
                status=status.HTTP_409_CONFLICT,
            )
        except StripeConfigurationError as exc:
            return Response(
                {"detail": str(exc), "code": "stripe_not_configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except StripeUserInputError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except StripeServiceError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"checkout_url": checkout_url}, status=status.HTTP_200_OK)


class StripeCustomerPortalView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            portal_url = StripeService.create_customer_portal_session(request.user)
        except StripeConfigurationError as exc:
            return Response(
                {"detail": str(exc), "code": "stripe_not_configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except StripeUserInputError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except StripeServiceError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"portal_url": portal_url}, status=status.HTTP_200_OK)


@csrf_exempt
@require_POST
def stripe_webhook_view(request):
    try:
        StripeService.handle_webhook(
            request.body,
            request.headers.get("Stripe-Signature", ""),
        )
    except StripeWebhookSignatureError:
        return HttpResponse(status=400)
    except StripeConfigurationError:
        logger.exception("Stripe webhook received before Stripe was fully configured.")
        return HttpResponse(status=503)
    except StripeServiceError:
        logger.exception("Stripe webhook processing failed.")
        return HttpResponse(status=500)

    return HttpResponse(status=200)
