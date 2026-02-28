from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from .exceptions import ServiceError
from .models import JobRequest, Response


class JobRequestCreateAPITest(TestCase):
    """Reproduce POST /api/jobs/ and assert 201 (no 500)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="client@example.com",
            password="testpass123",
            full_name="Test Client",
            role=User.Role.CLIENT,
        )
        self.client.force_authenticate(user=self.user)

    def test_post_jobs_minimal_payload_returns_201(self):
        resp = self.client.post(
            "/api/jobs/",
            {"title": "Test job", "description": "Test description"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, msg=resp.content)
        data = resp.json()
        self.assertEqual(data["title"], "Test job")
        self.assertEqual(data["description"], "Test description")
        self.assertIn("id", data)
        self.assertIn("created_at", data)


class JobRequestPatchDeleteAPITest(TestCase):
    """Client self-management: PATCH, Cancel (CANCELLED), Delete (DELETED); feed and list visibility."""

    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="testpass123",
            full_name="Owner",
            role=User.Role.CLIENT,
        )
        self.other = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
            full_name="Other Client",
            role=User.Role.CLIENT,
        )
        self.provider_user = User.objects.create_user(
            email="provider@example.com",
            password="testpass123",
            full_name="Provider",
            role=User.Role.PROVIDER,
            is_provider=True,
        )

    def test_client_can_patch_own_open_job(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Original",
            description="Desc",
            status=JobRequest.Status.OPEN,
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.patch(
            f"/api/jobs/{job.id}/",
            {"title": "Updated title", "description": "Updated desc"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        data = resp.json()
        self.assertEqual(data["title"], "Updated title")
        self.assertEqual(data["description"], "Updated desc")
        self.assertEqual(data["status"], JobRequest.Status.OPEN)
        job.refresh_from_db()
        self.assertEqual(job.title, "Updated title")

    def test_client_cannot_patch_someone_elses_job(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Owner job",
            description="Desc",
            status=JobRequest.Status.OPEN,
        )
        self.api.force_authenticate(user=self.other)
        resp = self.api.patch(
            f"/api/jobs/{job.id}/",
            {"title": "Hacked"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403, msg=resp.content)

    def test_client_cannot_patch_assigned_job(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Assigned job",
            description="Desc",
            status=JobRequest.Status.ASSIGNED,
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.patch(
            f"/api/jobs/{job.id}/",
            {"title": "Updated"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400, msg=resp.content)
        self.assertIn("detail", resp.json())
        self.assertIn("open", resp.json()["detail"].lower())

    def test_client_patch_with_response_price_credits_does_not_change_it(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Open job",
            description="Desc",
            status=JobRequest.Status.OPEN,
            response_price_credits=2,
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.patch(
            f"/api/jobs/{job.id}/",
            {"title": "Updated title", "response_price_credits": 99},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        job.refresh_from_db()
        self.assertEqual(job.title, "Updated title")
        self.assertEqual(job.response_price_credits, 2, "response_price_credits must not be changed by client PATCH")

    def test_client_can_cancel_own_open_job(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Open job",
            description="Desc",
            status=JobRequest.Status.OPEN,
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.post(f"/api/jobs/{job.id}/cancel/", format="json")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        data = resp.json()
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("status"), JobRequest.Status.CANCELLED)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.CANCELLED)

    def test_cancelled_job_not_in_provider_feed(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Cancelled job",
            description="Desc",
            status=JobRequest.Status.CANCELLED,
            visibility=JobRequest.Visibility.PUBLIC,
        )
        self.api.force_authenticate(user=self.provider_user)
        resp = self.api.get("/api/feed/")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        results = resp.json().get("results") or []
        ids = [r["id"] for r in results]
        self.assertNotIn(job.id, ids, "Cancelled job must not appear in provider feed")

    def test_client_can_delete_own_open_job(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Job to delete",
            description="Desc",
            status=JobRequest.Status.OPEN,
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.delete(f"/api/jobs/{job.id}/")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        data = resp.json()
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("status"), JobRequest.Status.DELETED)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.DELETED)

    def test_client_delete_with_responses_results_in_deleted(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Job with responses",
            description="Desc",
            status=JobRequest.Status.OPEN,
        )
        Response.objects.create(
            job=job,
            provider=self.provider_user,
            proposed_price_amd=1000,
            timeline_text="Soon",
            cover_message="Offer",
        )
        job.refresh_from_db()
        self.api.force_authenticate(user=self.owner)
        resp = self.api.delete(f"/api/jobs/{job.id}/")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.DELETED)

    def test_deleted_job_not_in_default_client_list_and_not_in_feed(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Deleted job",
            description="Desc",
            status=JobRequest.Status.DELETED,
            visibility=JobRequest.Visibility.PUBLIC,
        )
        self.api.force_authenticate(user=self.owner)
        list_resp = self.api.get("/api/jobs/")
        self.assertEqual(list_resp.status_code, 200)
        list_ids = [r["id"] for r in (list_resp.json().get("results") or [])]
        self.assertNotIn(job.id, list_ids, "Deleted job must not appear in default client list")
        self.api.force_authenticate(user=self.provider_user)
        feed_resp = self.api.get("/api/feed/")
        self.assertEqual(feed_resp.status_code, 200)
        feed_ids = [r["id"] for r in (feed_resp.json().get("results") or [])]
        self.assertNotIn(job.id, feed_ids, "Deleted job must not appear in provider feed")

    def test_client_can_reopen_own_cancelled_job_with_no_responses(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Cancelled job",
            description="Desc",
            status=JobRequest.Status.CANCELLED,
            responses_count=0,
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.post(f"/api/jobs/{job.id}/reopen/", format="json")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        data = resp.json()
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("status"), JobRequest.Status.OPEN)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.OPEN)

    def test_client_cannot_reopen_cancelled_job_with_responses(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Cancelled with responses",
            description="Desc",
            status=JobRequest.Status.CANCELLED,
            responses_count=1,
        )
        Response.objects.create(
            job=job,
            provider=self.provider_user,
            proposed_price_amd=500,
            timeline_text="Soon",
            cover_message="Offer",
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.post(f"/api/jobs/{job.id}/reopen/", format="json")
        self.assertEqual(resp.status_code, 400, msg=resp.content)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.CANCELLED)

    def test_list_filter_by_status(self):
        open_job = JobRequest.objects.create(
            client=self.owner, title="Open", description="D", status=JobRequest.Status.OPEN
        )
        cancelled_job = JobRequest.objects.create(
            client=self.owner, title="Cancelled", description="D", status=JobRequest.Status.CANCELLED
        )
        deleted_job = JobRequest.objects.create(
            client=self.owner, title="Deleted", description="D", status=JobRequest.Status.DELETED
        )
        self.api.force_authenticate(user=self.owner)

        resp = self.api.get("/api/jobs/?status=open")
        self.assertEqual(resp.status_code, 200)
        ids = [r["id"] for r in (resp.json().get("results") or [])]
        self.assertIn(open_job.id, ids)
        self.assertNotIn(cancelled_job.id, ids)
        self.assertNotIn(deleted_job.id, ids)

        resp = self.api.get("/api/jobs/?status=cancelled")
        self.assertEqual(resp.status_code, 200)
        ids = [r["id"] for r in (resp.json().get("results") or [])]
        self.assertIn(cancelled_job.id, ids)
        self.assertNotIn(open_job.id, ids)
        self.assertNotIn(deleted_job.id, ids)

        resp = self.api.get("/api/jobs/?status=deleted")
        self.assertEqual(resp.status_code, 200)
        ids = [r["id"] for r in (resp.json().get("results") or [])]
        self.assertIn(deleted_job.id, ids)
        self.assertNotIn(open_job.id, ids)
        self.assertNotIn(cancelled_job.id, ids)

    def test_client_can_restore_deleted_job(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Deleted job",
            description="Desc",
            status=JobRequest.Status.DELETED,
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.post(f"/api/jobs/{job.id}/restore/", format="json")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        data = resp.json()
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("status"), JobRequest.Status.OPEN)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.OPEN)

    def test_client_can_retrieve_deleted_job(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Deleted job",
            description="Desc",
            status=JobRequest.Status.DELETED,
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.get(f"/api/jobs/{job.id}/")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        self.assertEqual(resp.json().get("status"), JobRequest.Status.DELETED)


class AcceptRejectWorkflowTest(TestCase):
    """Accept/reject response: only owner or admin; one accept → job ASSIGNED; reject keeps OPEN; feed excludes assigned."""

    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="testpass123",
            full_name="Owner",
            role=User.Role.CLIENT,
        )
        self.other_client = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
            full_name="Other",
            role=User.Role.CLIENT,
        )
        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            password="testpass123",
            full_name="Admin",
            role=User.Role.ADMIN,
        )
        self.provider_user = User.objects.create_user(
            email="provider@example.com",
            password="testpass123",
            full_name="Provider",
            role=User.Role.PROVIDER,
            is_provider=True,
        )
        self.other_provider = User.objects.create_user(
            email="provider2@example.com",
            password="testpass123",
            full_name="Provider2",
            role=User.Role.PROVIDER,
            is_provider=True,
        )

    def test_accept_reject_requires_decision_status_and_response_id(self):
        job = JobRequest.objects.create(
            client=self.owner, title="Job", description="Desc", status=JobRequest.Status.OPEN
        )
        r = Response.objects.create(
            job=job, provider=self.provider_user, cover_message="Offer", decision_status=Response.DecisionStatus.PENDING
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.post(
            f"/api/jobs/{job.id}/accept-reject/",
            {"response_id": r.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400, msg=resp.content)
        resp2 = self.api.post(
            f"/api/jobs/{job.id}/accept-reject/",
            {"decision_status": "accepted"},
            format="json",
        )
        self.assertEqual(resp2.status_code, 400, msg=resp2.content)

    def test_owner_can_accept_response_job_becomes_assigned(self):
        job = JobRequest.objects.create(
            client=self.owner, title="Job", description="Desc", status=JobRequest.Status.OPEN
        )
        r1 = Response.objects.create(
            job=job, provider=self.provider_user, cover_message="Offer", decision_status=Response.DecisionStatus.PENDING
        )
        r2 = Response.objects.create(
            job=job, provider=self.other_provider, cover_message="Offer2", decision_status=Response.DecisionStatus.PENDING
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.post(
            f"/api/jobs/{job.id}/accept-reject/",
            {"response_id": r1.id, "decision_status": "accepted"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        data = resp.json()
        self.assertEqual(data.get("job_status"), JobRequest.Status.ASSIGNED)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.ASSIGNED)
        r1.refresh_from_db()
        r2.refresh_from_db()
        self.assertEqual(r1.decision_status, Response.DecisionStatus.ACCEPTED)
        self.assertEqual(r2.decision_status, Response.DecisionStatus.REJECTED)

    def test_other_client_cannot_accept_reject(self):
        job = JobRequest.objects.create(
            client=self.owner, title="Job", description="Desc", status=JobRequest.Status.OPEN
        )
        r = Response.objects.create(
            job=job, provider=self.provider_user, cover_message="Offer", decision_status=Response.DecisionStatus.PENDING
        )
        self.api.force_authenticate(user=self.other_client)
        resp = self.api.post(
            f"/api/jobs/{job.id}/accept-reject/",
            {"response_id": r.id, "decision_status": "accepted"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403, msg=resp.content)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.OPEN)

    def test_admin_can_accept_response(self):
        job = JobRequest.objects.create(
            client=self.owner, title="Job", description="Desc", status=JobRequest.Status.OPEN
        )
        r = Response.objects.create(
            job=job, provider=self.provider_user, cover_message="Offer", decision_status=Response.DecisionStatus.PENDING
        )
        self.api.force_authenticate(user=self.admin_user)
        resp = self.api.post(
            f"/api/jobs/{job.id}/accept-reject/",
            {"response_id": r.id, "decision_status": "accepted"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.ASSIGNED)

    def test_reject_keeps_job_open(self):
        job = JobRequest.objects.create(
            client=self.owner, title="Job", description="Desc", status=JobRequest.Status.OPEN
        )
        r = Response.objects.create(
            job=job, provider=self.provider_user, cover_message="Offer", decision_status=Response.DecisionStatus.PENDING
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.post(
            f"/api/jobs/{job.id}/accept-reject/",
            {"response_id": r.id, "decision_status": "rejected"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.OPEN)
        r.refresh_from_db()
        self.assertEqual(r.decision_status, Response.DecisionStatus.REJECTED)

    def test_cannot_accept_when_job_already_assigned(self):
        job = JobRequest.objects.create(
            client=self.owner, title="Job", description="Desc", status=JobRequest.Status.ASSIGNED
        )
        r = Response.objects.create(
            job=job, provider=self.provider_user, cover_message="Offer", decision_status=Response.DecisionStatus.ACCEPTED
        )
        r2 = Response.objects.create(
            job=job, provider=self.other_provider, cover_message="Offer2", decision_status=Response.DecisionStatus.REJECTED
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.post(
            f"/api/jobs/{job.id}/accept-reject/",
            {"response_id": r2.id, "decision_status": "accepted"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400, msg=resp.content)
        detail = (resp.json().get("detail") or "").lower()
        self.assertTrue("accept" in detail or "not open" in detail, msg=f"Expected 'accept' or 'not open' in detail: {detail}")
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.ASSIGNED)

    def test_submit_response_blocked_for_assigned_job(self):
        from marketplace.services import submit_response

        job = JobRequest.objects.create(
            client=self.owner, title="Job", description="Desc", status=JobRequest.Status.ASSIGNED
        )
        with self.assertRaises(ServiceError) as ctx:
            submit_response(
                provider_user=self.other_provider,
                job_id=job.id,
                payload_dict={"cover_message": "Late offer"},
                request_id="test",
            )
        self.assertIn("already assigned", ctx.exception.message.lower())

    def test_cannot_reject_when_job_not_open(self):
        job = JobRequest.objects.create(
            client=self.owner, title="Job", description="Desc", status=JobRequest.Status.ASSIGNED
        )
        r = Response.objects.create(
            job=job, provider=self.provider_user, cover_message="Offer", decision_status=Response.DecisionStatus.PENDING
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.post(
            f"/api/jobs/{job.id}/accept-reject/",
            {"response_id": r.id, "decision_status": "rejected"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400, msg=resp.content)
        self.assertIn("not open", (resp.json().get("detail") or "").lower())
        job.refresh_from_db()
        self.assertEqual(job.status, JobRequest.Status.ASSIGNED)

    def test_assigned_job_not_in_provider_feed(self):
        job = JobRequest.objects.create(
            client=self.owner,
            title="Assigned job",
            description="Desc",
            status=JobRequest.Status.ASSIGNED,
            visibility=JobRequest.Visibility.PUBLIC,
        )
        self.api.force_authenticate(user=self.provider_user)
        resp = self.api.get("/api/feed/")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        results = resp.json().get("results") or []
        ids = [r["id"] for r in results]
        self.assertNotIn(job.id, ids, "Assigned job must not appear in provider feed")

    def test_job_detail_includes_accepted_response_when_assigned(self):
        job = JobRequest.objects.create(
            client=self.owner, title="Job", description="Desc", status=JobRequest.Status.ASSIGNED
        )
        r = Response.objects.create(
            job=job, provider=self.provider_user, cover_message="Won", decision_status=Response.DecisionStatus.ACCEPTED
        )
        self.api.force_authenticate(user=self.owner)
        resp = self.api.get(f"/api/jobs/{job.id}/")
        self.assertEqual(resp.status_code, 200, msg=resp.content)
        data = resp.json()
        self.assertEqual(data["status"], JobRequest.Status.ASSIGNED)
        acc = data.get("accepted_response")
        self.assertIsNotNone(acc)
        self.assertEqual(acc["id"], r.id)
        self.assertEqual(acc["provider_email"], self.provider_user.email)
