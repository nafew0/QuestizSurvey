from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from PIL import Image, UnidentifiedImageError
import os

from subscriptions.serializers import PlanSummarySerializer
from subscriptions.services import LicenseService

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""

    current_plan = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "is_staff",
            "is_superuser",
            "first_name",
            "last_name",
            "bio",
            "avatar",
            "organization",
            "designation",
            "phone",
            "email_verified",
            "current_plan",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_current_plan(self, obj):
        plan = LicenseService.get_user_plan(obj)
        return PlanSummarySerializer(plan).data


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "password2",
            "first_name",
            "last_name",
            "organization",
        ]

    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        """Create a new user with encrypted password."""
        validated_data.pop("password2")
        user = User.objects.create_user(**validated_data)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "bio",
            "avatar",
            "email",
            "organization",
            "designation",
            "phone",
        ]

    def validate_email(self, value):
        """Check if email is already in use by another user."""
        user = self.context["request"].user
        if User.objects.exclude(pk=user.pk).filter(email=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate_phone(self, value):
        """Allow common international phone formats without being overly strict."""
        normalized = (value or "").strip()
        if not normalized:
            return ""

        allowed_characters = set("0123456789+()-. ")
        if any(character not in allowed_characters for character in normalized):
            raise serializers.ValidationError(
                "Phone number may contain only digits, spaces, and + ( ) - . characters."
            )
        return normalized

    def validate_avatar(self, value):
        """Validate avatar uploads to common safe image formats and a sane size."""
        if not value:
            return value

        max_size_bytes = 5 * 1024 * 1024
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
        allowed_content_types = {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
        }

        if value.size > max_size_bytes:
            raise serializers.ValidationError("Avatar image must be 5 MB or smaller.")

        extension = os.path.splitext(value.name or "")[1].lower()
        if extension and extension not in allowed_extensions:
            raise serializers.ValidationError(
                "Avatar must be a JPG, PNG, WEBP, or GIF image."
            )

        content_type = getattr(value, "content_type", "")
        if content_type and content_type.lower() not in allowed_content_types:
            raise serializers.ValidationError(
                "Avatar must be a JPG, PNG, WEBP, or GIF image."
            )

        try:
            image = Image.open(value)
            image.verify()
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise serializers.ValidationError("Upload a valid image file.") from exc
        finally:
            value.seek(0)

        return value


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing user password."""

    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(
        required=True, write_only=True, validators=[validate_password]
    )
    new_password2 = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        """Validate that new passwords match."""
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError(
                {"new_password": "Password fields didn't match."}
            )
        return attrs

    def validate_old_password(self, value):
        """Validate that old password is correct."""
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class VerificationEmailRequestSerializer(serializers.Serializer):
    """Public resend request payload."""

    identifier = serializers.CharField(required=True, max_length=255)

    def validate_identifier(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Identifier is required.")
        return normalized


class PasswordResetRequestSerializer(serializers.Serializer):
    """Public forgot-password request payload."""

    identifier = serializers.CharField(required=True, max_length=255)

    def validate_identifier(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Identifier is required.")
        return normalized


class VerifyEmailQuerySerializer(serializers.Serializer):
    """Verification query string payload."""

    token = serializers.CharField(required=True, max_length=64)

    def validate_token(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Verification token is required.")
        if len(normalized) != 64:
            raise serializers.ValidationError("Verification token is invalid.")
        return normalized
