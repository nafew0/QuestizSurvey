from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .admin_serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetValidateSerializer,
)
from .password_reset import is_password_reset_token_valid


def revoke_user_refresh_tokens(user):
    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)


class PasswordResetValidateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        serializer = PasswordResetValidateSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        user = is_password_reset_token_valid(
            serializer.validated_data["uid"],
            serializer.validated_data["token"],
        )
        if not user:
            return Response(
                {"detail": "This password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "valid": True,
                "username": user.username,
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = is_password_reset_token_valid(
            serializer.validated_data["uid"],
            serializer.validated_data["token"],
        )
        if not user:
            return Response(
                {"detail": "This password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user.set_password(serializer.validated_data["new_password"])
            user.save(update_fields=["password"])
            revoke_user_refresh_tokens(user)

        return Response(
            {"detail": "Password reset successful."},
            status=status.HTTP_200_OK,
        )
