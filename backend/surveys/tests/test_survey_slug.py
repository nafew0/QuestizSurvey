from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from surveys.models import Survey


User = get_user_model()


class SurveySlugUpdateTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="slug-owner",
            email="slug-owner@example.com",
            password="TestPass123!",
        )
        self.other_user = User.objects.create_user(
            username="other-slug-owner",
            email="other-slug-owner@example.com",
            password="TestPass123!",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.public_client = APIClient()
        self.survey = Survey.objects.create(
            user=self.owner,
            title="Custom link survey",
            status=Survey.Status.ACTIVE,
        )

    def slug_url(self, survey=None):
        target = survey or self.survey
        return f"/api/surveys/{target.id}/slug/"

    def test_owner_can_normalize_and_update_slug(self):
        old_slug = self.survey.slug

        response = self.client.patch(
            self.slug_url(),
            {"slug": "  KU  "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], "ku")

        self.survey.refresh_from_db()
        self.assertEqual(self.survey.slug, "ku")
        self.assertEqual(
            self.public_client.get("/api/public/surveys/ku/").status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.public_client.get(
                f"/api/public/surveys/{old_slug}/"
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_invalid_and_reserved_slugs_are_rejected(self):
        invalid_values = [
            "a",
            "a" * 33,
            "customer--feedback",
            "-customer",
            "customer-",
            "customer/feedback",
            "https://example.com/survey",
            "dashboard",
            "profile",
            "API",
        ]

        for value in invalid_values:
            with self.subTest(value=value):
                response = self.client.patch(
                    self.slug_url(),
                    {"slug": value},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("slug", response.data)

        self.survey.refresh_from_db()
        self.assertNotIn(self.survey.slug, invalid_values)

    def test_slug_used_by_another_survey_returns_conflict(self):
        Survey.objects.create(
            user=self.other_user,
            title="Taken link",
            slug="taken-link",
        )

        response = self.client.patch(
            self.slug_url(),
            {"slug": "TAKEN-LINK"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "slug_taken")
        self.assertIn("slug", response.data)

    def test_saving_current_slug_is_idempotent(self):
        response = self.client.patch(
            self.slug_url(),
            {"slug": self.survey.slug},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], self.survey.slug)

    def test_non_owner_cannot_update_slug(self):
        other_survey = Survey.objects.create(
            user=self.other_user,
            title="Private survey",
        )

        response = self.client.patch(
            self.slug_url(other_survey),
            {"slug": "not-yours"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        other_survey.refresh_from_db()
        self.assertNotEqual(other_survey.slug, "not-yours")

    def test_unauthenticated_user_cannot_update_slug(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.slug_url(),
            {"slug": "public-edit"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_late_unique_constraint_failure_returns_conflict(self):
        with patch.object(
            Survey,
            "save",
            autospec=True,
            side_effect=IntegrityError("duplicate slug"),
        ):
            response = self.client.patch(
                self.slug_url(),
                {"slug": "race-safe"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "slug_taken")
