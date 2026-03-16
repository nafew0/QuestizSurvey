from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class UserRegistrationTestCase(TestCase):
    """Test cases for user registration."""

    def setUp(self):
        self.client = APIClient()
        self.register_url = "/api/auth/register/"

    def test_user_registration_success(self):
        """Test successful user registration."""
        data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "TestPass123!",
            "password2": "TestPass123!",
            "first_name": "Test",
            "last_name": "User",
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("tokens", response.data)
        self.assertIn("user", response.data)

    def test_user_registration_password_mismatch(self):
        """Test registration with mismatched passwords."""
        data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "TestPass123!",
            "password2": "DifferentPass123!",
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserLoginTestCase(TestCase):
    """Test cases for user login."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = "/api/auth/login/"
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="TestPass123!"
        )

    def test_user_login_success(self):
        """Test successful user login."""
        data = {"username": "testuser", "password": "TestPass123!"}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("tokens", response.data)
        self.assertIn("user", response.data)

    def test_user_login_success_with_email(self):
        """Test successful user login with email."""
        data = {"username": "test@example.com", "password": "TestPass123!"}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("tokens", response.data)
        self.assertEqual(response.data["user"]["username"], "testuser")

    def test_superuser_login_success(self):
        """Test successful superuser login from the app login endpoint."""
        admin = User.objects.create_superuser(
            username="admin", email="admin@example.com", password="AdminPass123!"
        )
        response = self.client.post(
            self.login_url,
            {"username": admin.username, "password": "AdminPass123!"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "admin")
        self.assertTrue(response.data["user"]["is_staff"])

    def test_user_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        data = {"username": "testuser", "password": "WrongPassword"}
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserProfileUpdateTestCase(TestCase):
    """Test cases for authenticated profile fetch and updates."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="profileuser",
            email="profile@example.com",
            password="TestPass123!",
        )
        self.client.force_authenticate(user=self.user)
        self.get_user_url = "/api/auth/user/"
        self.update_url = "/api/auth/user/update/"

    def test_get_user_includes_extended_profile_fields(self):
        response = self.client.get(self.get_user_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("organization", response.data)
        self.assertIn("designation", response.data)
        self.assertIn("phone", response.data)

    def test_profile_update_accepts_extended_fields(self):
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
        self.user.refresh_from_db()
        self.assertEqual(self.user.organization, payload["organization"])
        self.assertEqual(self.user.designation, payload["designation"])
        self.assertEqual(self.user.phone, payload["phone"])
        self.assertEqual(response.data["organization"], payload["organization"])

    def test_profile_update_rejects_invalid_phone_characters(self):
        response = self.client.patch(
            self.update_url,
            {"phone": "555-123<script>"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_profile_update_rejects_invalid_avatar_file(self):
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
