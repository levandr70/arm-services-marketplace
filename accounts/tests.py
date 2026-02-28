from django.test import TestCase
from rest_framework.test import APIClient

from .models import User


class UserCapabilityFlagsTest(TestCase):
    """Capability flags is_client / is_provider; enable-provider; permissions."""

    def setUp(self):
        self.api = APIClient()

    def test_user_can_have_both_flags(self):
        user = User.objects.create_user(
            email="both@example.com",
            password="testpass123",
            full_name="Both",
            role=User.Role.CLIENT,
            is_client=True,
            is_provider=True,
        )
        self.assertTrue(user.is_client)
        self.assertTrue(user.is_provider)

    def test_me_returns_is_client_is_provider(self):
        user = User.objects.create_user(
            email="client@example.com",
            password="testpass123",
            full_name="Client",
            role=User.Role.CLIENT,
            is_client=True,
            is_provider=False,
        )
        self.api.force_authenticate(user=user)
        resp = self.api.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("is_client", data)
        self.assertIn("is_provider", data)
        self.assertTrue(data["is_client"])
        self.assertFalse(data["is_provider"])

    def test_enable_provider_sets_flag_and_creates_profile(self):
        user = User.objects.create_user(
            email="user@example.com",
            password="testpass123",
            full_name="User",
            role=User.Role.CLIENT,
            is_client=True,
            is_provider=False,
        )
        self.api.force_authenticate(user=user)
        resp = self.api.post("/api/auth/enable-provider/", format="json")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("is_provider"))
        self.assertTrue(data.get("is_client"))
        self.assertEqual(data.get("provider_verification_status"), "pending")

        user.refresh_from_db()
        self.assertTrue(user.is_provider)
        self.assertTrue(user.provider_profile)
        self.assertEqual(user.provider_profile.verification_status, "pending")

    def test_provider_endpoints_require_is_provider(self):
        # User with is_provider=False cannot access provider feed
        user = User.objects.create_user(
            email="clientonly@example.com",
            password="testpass123",
            full_name="Client Only",
            role=User.Role.CLIENT,
            is_client=True,
            is_provider=False,
        )
        self.api.force_authenticate(user=user)
        resp = self.api.get("/api/feed/")
        self.assertEqual(resp.status_code, 403)

        resp = self.api.get("/api/my-responses/")
        self.assertEqual(resp.status_code, 403)

    def test_after_enable_provider_can_access_feed_and_my_responses(self):
        user = User.objects.create_user(
            email="will_be_provider@example.com",
            password="testpass123",
            full_name="Will Be Provider",
            role=User.Role.CLIENT,
            is_client=True,
            is_provider=False,
        )
        self.api.force_authenticate(user=user)

        resp = self.api.get("/api/feed/")
        self.assertEqual(resp.status_code, 403)

        resp = self.api.post("/api/auth/enable-provider/", format="json")
        self.assertEqual(resp.status_code, 200)

        resp = self.api.get("/api/feed/")
        self.assertEqual(resp.status_code, 200)

        resp = self.api.get("/api/my-responses/")
        self.assertEqual(resp.status_code, 200)
