import logging

from django.contrib.auth.models import update_last_login
from django.core.exceptions import ImproperlyConfigured
from django.db.models import Q
from django.db import transaction
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model

from .models import EmailVerificationToken
from .serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    UserUpdateSerializer,
    ChangePasswordSerializer,
    VerificationEmailRequestSerializer,
    VerifyEmailQuerySerializer,
)
from .verification import (
    get_request_ip_address,
    get_site_settings,
    get_user_verification_retry_after_seconds,
    is_email_verification_required,
    mask_email,
    send_verification_email,
    should_throttle_public_resend,
    VERIFICATION_EMAIL_COOLDOWN_SECONDS,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class EmailVerificationUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Email verification is temporarily unavailable. Please try again later."
    default_code = "email_verification_unavailable"


def build_verification_required_response(user):
    return {
        "detail": "Please verify your email before logging in.",
        "email_verification_required": True,
        "email_hint": mask_email(user.email),
        "resend_available": True,
    }


def get_resend_verification_response():
    return {
        "detail": "If an eligible account exists, a verification email will arrive shortly.",
        "email_verification_required": True,
        "cooldown_seconds": VERIFICATION_EMAIL_COOLDOWN_SECONDS,
    }


def maybe_send_verification_email_or_raise(user):
    try:
        send_verification_email(user)
    except (ImproperlyConfigured, ValueError) as exc:
        logger.error("Verification email configuration error.", exc_info=True)
        raise EmailVerificationUnavailable() from exc
    except Exception as exc:
        logger.exception("Verification email delivery failed.")
        raise EmailVerificationUnavailable() from exc


def get_public_resend_user(identifier):
    normalized_identifier = (identifier or "").strip()
    if not normalized_identifier:
        return None

    return (
        User.objects.filter(
            Q(username__iexact=normalized_identifier) | Q(email__iexact=normalized_identifier),
            is_active=True,
        )
        .distinct()
        .first()
    )


class RegisterView(generics.CreateAPIView):
    """
    User registration endpoint.
    POST: Create a new user account.
    """

    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        site_settings = get_site_settings()
        verification_required = site_settings.require_email_verification
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = serializer.save(email_verified=not verification_required)

            if verification_required:
                maybe_send_verification_email_or_raise(user)

        response_payload = {
            "user": UserSerializer(user).data,
            "message": "User registered successfully.",
            "email_verification_required": verification_required,
            "email_hint": mask_email(user.email),
        }

        if verification_required:
            response_payload["message"] = "Registration successful. Please check your email to verify your account."
            return Response(response_payload, status=status.HTTP_201_CREATED)

        refresh = RefreshToken.for_user(user)
        response_payload["tokens"] = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }
        return Response(response_payload, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """
    User login endpoint.
    Accepts either username or email and returns user data with JWT tokens.
    """
    identifier = (request.data.get("username") or request.data.get("identifier") or "").strip()
    password = request.data.get("password") or ""

    if not identifier or not password:
        return Response(
            {"detail": "Username/email and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = (
        User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier))
        .distinct()
        .first()
    )

    if not user or not user.check_password(password) or not user.is_active:
        return Response(
            {"detail": "No active account found with the given credentials."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if is_email_verification_required() and not user.email_verified:
        return Response(
            build_verification_required_response(user),
            status=status.HTTP_403_FORBIDDEN,
        )

    refresh = RefreshToken.for_user(user)
    update_last_login(None, user)

    return Response(
        {
            "user": UserSerializer(user).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            "message": "Login successful.",
        },
        status=status.HTTP_200_OK,
    )


class VerifiedTokenRefreshView(TokenRefreshView):
    """Refresh tokens while enforcing email verification when required."""

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                user_id = token.get("user_id")
                user = User.objects.filter(pk=user_id).only("id", "email", "email_verified").first()
                if user and is_email_verification_required() and not user.email_verified:
                    return Response(
                        build_verification_required_response(user),
                        status=status.HTTP_403_FORBIDDEN,
                    )
            except TokenError:
                pass

        return super().post(request, *args, **kwargs)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    User logout endpoint.
    Blacklists the refresh token.
    """
    try:
        refresh_token = request.data.get("refresh_token")
        if not refresh_token:
            return Response(
                {"error": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = RefreshToken(refresh_token)
        token.blacklist()

        return Response({"message": "Logout successful."}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_view(request):
    """
    Get current authenticated user.
    """
    serializer = UserSerializer(request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)


class UpdateProfileView(generics.UpdateAPIView):
    """
    Update user profile endpoint.
    PATCH/PUT: Update user profile information.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UserUpdateSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_verification_email_view(request):
    """Send a verification email for the authenticated user."""
    user = request.user

    if user.email_verified:
        return Response(
            {"detail": "Your email is already verified.", "email_verification_required": False},
            status=status.HTTP_200_OK,
        )

    retry_after_seconds = get_user_verification_retry_after_seconds(user)
    if retry_after_seconds > 0:
        return Response(
            {
                "detail": "Please wait before requesting another verification email.",
                "retry_after_seconds": retry_after_seconds,
                "email_verification_required": True,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    maybe_send_verification_email_or_raise(user)
    return Response(
        {
            "detail": "Verification email sent successfully.",
            "email_verification_required": True,
            "email_hint": mask_email(user.email),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def resend_verification_email_view(request):
    """Public resend endpoint with generic responses to avoid account enumeration."""
    serializer = VerificationEmailRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if should_throttle_public_resend(get_request_ip_address(request)):
        return Response(get_resend_verification_response(), status=status.HTTP_200_OK)

    user = get_public_resend_user(serializer.validated_data["identifier"])
    if not user or user.email_verified or not is_email_verification_required():
        return Response(get_resend_verification_response(), status=status.HTTP_200_OK)

    retry_after_seconds = get_user_verification_retry_after_seconds(user)
    if retry_after_seconds > 0:
        return Response(get_resend_verification_response(), status=status.HTTP_200_OK)

    try:
        send_verification_email(user)
    except Exception:
        logger.exception("Public resend verification email failed.")

    return Response(get_resend_verification_response(), status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def verify_email_view(request):
    """Verify a user's email from a verification link."""
    serializer = VerifyEmailQuerySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)

    verification_token = (
        EmailVerificationToken.objects.select_related("user")
        .filter(token=serializer.validated_data["token"])
        .first()
    )

    if not verification_token:
        return Response(
            {"detail": "Invalid or expired verification link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = verification_token.user
    if verification_token.used:
        if user.email_verified:
            return Response(
                {"detail": "Email already verified.", "email_verified": True},
                status=status.HTTP_200_OK,
            )
        return Response(
            {"detail": "Invalid or expired verification link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if verification_token.is_expired:
        return Response(
            {"detail": "Invalid or expired verification link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
        verification_token.used = True
        verification_token.save(update_fields=["used"])

    return Response(
        {"detail": "Email verified successfully.", "email_verified": True},
        status=status.HTTP_200_OK,
    )


class ChangePasswordView(generics.UpdateAPIView):
    """
    Change user password endpoint.
    POST: Change user password.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Set new password
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save()

        return Response(
            {"message": "Password changed successfully."}, status=status.HTTP_200_OK
        )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_account_view(request):
    """
    Delete user account endpoint.
    DELETE: Delete the authenticated user's account.
    """
    user = request.user
    user.delete()

    return Response(
        {"message": "Account deleted successfully."}, status=status.HTTP_200_OK
    )
