"""
Single source of truth for marketplace business logic.
Used by both DRF (marketplace/views.py) and webui (webui/views.py).
"""
import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import Avg, F
from django.utils import timezone

from core.email_utils import notify_client_new_offer, notify_provider_decision
from payments.models import CreditTransaction

from .exceptions import ServiceError
from .models import Category, City, ClientReview, JobRequest, ProviderProfile, Response, get_marketplace_settings

logger = logging.getLogger(__name__)


def create_job(*, client_user, data_dict, request_id=None):
    """
    Create a JobRequest for the client with the given data.
    Applies defaults: status=OPEN, response_price_credits from MarketplaceSettings when omitted.
    Logs job_created. Returns the created JobRequest.
    """
    request_id = request_id or ""
    status_val = data_dict.get("status") or JobRequest.Status.OPEN
    response_price = data_dict.get("response_price_credits")
    if response_price is None:
        response_price = get_marketplace_settings().default_response_price_credits

    cat = data_dict.get("category")
    city = data_dict.get("city")
    if not isinstance(cat, Category):
        cat = Category.objects.filter(slug=(cat or "other")).first() or Category.objects.filter(slug="other").first()
    if not isinstance(city, City):
        city = City.objects.filter(slug=(city or "other")).first() or City.objects.filter(slug="other").first()

    job = JobRequest.objects.create(
        client=client_user,
        title=data_dict["title"],
        description=data_dict["description"],
        category=cat,
        city=city,
        budget_min_amd=data_dict.get("budget_min_amd"),
        budget_max_amd=data_dict.get("budget_max_amd"),
        deadline_date=data_dict.get("deadline_date"),
        visibility=data_dict.get("visibility", JobRequest.Visibility.PUBLIC),
        status=status_val,
        response_price_credits=response_price,
    )
    logger.info(
        "job_created",
        extra={"request_id": request_id, "client_id": job.client_id, "job_id": job.id},
    )
    return job


def submit_response(*, provider_user, job_id, payload_dict, request_id=None):
    """
    Submit a response to a job. Implements all rules: job exists, open, age <= 14 days,
    visibility/verified, no duplicate response, daily limit 30, atomic credit deduction.
    Best-effort notify_client_new_offer. Logs response_submitted with reason.
    Returns the created Response. Raises ServiceError on failure.
    """
    request_id = request_id or ""
    provider_id = provider_user.id

    if job_id is None:
        logger.info(
            "response_submitted",
            extra={"request_id": request_id, "provider_id": provider_id, "job_id": None, "reason": "job_id_required"},
        )
        raise ServiceError("job_id_required", "job_id is required.", 400)

    try:
        job = JobRequest.objects.get(pk=job_id)
    except JobRequest.DoesNotExist:
        logger.info(
            "response_submitted",
            extra={"request_id": request_id, "provider_id": provider_id, "job_id": job_id, "reason": "job_not_found"},
        )
        raise ServiceError("job_not_found", "Job not found.", 404)

    # Prevent providers from responding to their own jobs (even if they are also a provider).
    if job.client_id == provider_id:
        logger.info(
            "response_submitted",
            extra={
                "request_id": request_id,
                "provider_id": provider_id,
                "job_id": job_id,
                "reason": "self_response",
            },
        )
        raise ServiceError(
            "self_response",
            "You cannot respond to your own job.",
            400,
        )

    if job.status != JobRequest.Status.OPEN:
        logger.info(
            "response_submitted",
            extra={"request_id": request_id, "provider_id": provider_id, "job_id": job_id, "reason": "job_not_open"},
        )
        if job.status == JobRequest.Status.ASSIGNED:
            raise ServiceError("job_not_open", "Job already assigned.", 409)
        raise ServiceError(
            "job_not_open",
            "This job is no longer accepting responses.",
            409,
        )

    if job.visibility == JobRequest.Visibility.VERIFIED_ONLY:
        profile = ProviderProfile.objects.filter(user=provider_user).first()
        if not profile or profile.verification_status != "verified":
            logger.info(
                "response_submitted",
                extra={"request_id": request_id, "provider_id": provider_id, "job_id": job_id, "reason": "verified_only"},
            )
            raise ServiceError(
                "verified_only",
                "Only verified providers can respond to this job.",
                403,
            )

    if job.responses.filter(provider=provider_user).exists():
        logger.info(
            "response_submitted",
            extra={"request_id": request_id, "provider_id": provider_id, "job_id": job_id, "reason": "already_responded"},
        )
        raise ServiceError("already_responded", "You have already responded to this job.", 409)

    since_24h = timezone.now() - timedelta(hours=24)
    if Response.objects.filter(provider=provider_user, created_at__gte=since_24h).count() >= 30:
        logger.info(
            "response_submitted",
            extra={"request_id": request_id, "provider_id": provider_id, "job_id": job_id, "reason": "daily_limit"},
        )
        raise ServiceError("daily_limit", "Daily response limit reached.", 429)

    since_14d = timezone.now() - timedelta(days=14)
    if job.created_at < since_14d:
        logger.info(
            "response_submitted",
            extra={"request_id": request_id, "provider_id": provider_id, "job_id": job_id, "reason": "job_too_old"},
        )
        raise ServiceError("job_too_old", "This job is too old to respond.", 400)

    cover_message = payload_dict.get("cover_message") or ""
    raw_price = payload_dict.get("proposed_price_amd")
    try:
        proposed_price_amd = int(raw_price) if raw_price is not None else None
    except (TypeError, ValueError):
        proposed_price_amd = None
    timeline_text = payload_dict.get("timeline_text") or ""

    fee = job.response_price_credits

    try:
        with transaction.atomic():
            profile, _ = ProviderProfile.objects.get_or_create(
                user=provider_user,
                defaults={"company_name": ""},
            )
            profile = ProviderProfile.objects.select_for_update().get(pk=profile.pk)

            if profile.credits_balance < fee:
                logger.info(
                    "response_submitted",
                    extra={
                        "request_id": request_id,
                        "provider_id": provider_id,
                        "job_id": job_id,
                        "reason": "insufficient_credits",
                    },
                )
                raise ServiceError("insufficient_credits", "Not enough credits.", 400)

            profile.credits_balance -= fee
            profile.save(update_fields=["credits_balance"])

            response_obj = Response.objects.create(
                job=job,
                provider=provider_user,
                response_fee_credits=fee,
                payment_status=Response.PaymentStatus.PAID,
                decision_status=Response.DecisionStatus.PENDING,
                cover_message=cover_message,
                proposed_price_amd=proposed_price_amd,
                timeline_text=timeline_text,
            )
            CreditTransaction.objects.create(
                provider=provider_user,
                type=CreditTransaction.Type.USAGE,
                amount=-fee,
                balance_after=profile.credits_balance,
                related_response=response_obj,
                note=f"Response to job #{job.id}",
            )
            job.responses_count += 1
            job.save(update_fields=["responses_count"])
    except ServiceError:
        raise
    except Exception:
        logger.info(
            "response_submitted",
            extra={"request_id": request_id, "provider_id": provider_id, "job_id": job_id, "reason": "exception"},
        )
        raise ServiceError(
            "exception",
            "Something went wrong. Please try again.",
            500,
        )

    logger.info(
        "response_submitted",
        extra={"request_id": request_id, "provider_id": provider_id, "job_id": job.id, "reason": "success"},
    )
    notify_client_new_offer(job)
    return response_obj


def withdraw_response(*, provider_user, response_id, request_id=None):
    """
    Withdraw a pending response: refund credits, create REFUND transaction, delete response.
    Only allowed when job is OPEN and response decision_status is PENDING.
    """
    request_id = request_id or ""
    try:
        response_obj = Response.objects.select_related("job").get(pk=response_id, provider=provider_user)
    except Response.DoesNotExist:
        raise ServiceError("not_found", "Response not found.", 404)

    job = response_obj.job
    if job.status != JobRequest.Status.OPEN:
        raise ServiceError("job_not_open", "Cannot withdraw: job is no longer open.", 400)
    if response_obj.decision_status != Response.DecisionStatus.PENDING:
        raise ServiceError("response_decided", "Cannot withdraw: response was already accepted or rejected.", 400)

    fee = response_obj.response_fee_credits or 0
    provider_id = getattr(provider_user, "id", None)

    try:
        with transaction.atomic():
            profile = ProviderProfile.objects.select_for_update().get(user=provider_user)
            profile.credits_balance += fee
            profile.save(update_fields=["credits_balance"])
            CreditTransaction.objects.create(
                provider=provider_user,
                type=CreditTransaction.Type.REFUND,
                amount=fee,
                balance_after=profile.credits_balance,
                related_response=response_obj,
                note=f"Withdrew response for job #{job.id}",
            )
            response_obj.delete()
            job.responses_count = max(0, (job.responses_count or 0) - 1)
            job.save(update_fields=["responses_count"])
    except ProviderProfile.DoesNotExist:
        raise ServiceError("profile_missing", "Provider profile not found.", 500)
    except Exception:
        logger.info(
            "response_withdrawn",
            extra={"request_id": request_id, "provider_id": provider_id, "response_id": response_id, "reason": "exception"},
        )
        raise ServiceError("exception", "Something went wrong. Please try again.", 500)

    logger.info(
        "response_withdrawn",
        extra={"request_id": request_id, "provider_id": provider_id, "response_id": response_id, "reason": "success"},
    )
    return None


def decide_response(*, client_user, job_id, response_id, decision_status, request_id=None):
    """
    Accept or reject a response. Only job owner or admin can decide.
    If accepted: set response accepted, job status ASSIGNED, reject other responses.
    Only one response can be accepted; accepting is allowed only when job is OPEN.
    If rejected: set response rejected only; job stays OPEN.
    Best-effort notify_provider_decision. Logs accept_reject.
    Returns (job, response). Raises ServiceError on failure.
    """
    request_id = request_id or ""
    decision_status = (decision_status or "").strip().lower()
    if decision_status not in (Response.DecisionStatus.ACCEPTED, Response.DecisionStatus.REJECTED):
        raise ServiceError("invalid_decision", "decision_status must be 'accepted' or 'rejected'.", 400)

    try:
        job = JobRequest.objects.get(pk=job_id)
    except JobRequest.DoesNotExist:
        raise ServiceError("job_not_found", "Job not found.", 404)

    if not _job_owner_or_admin(job, client_user):
        raise ServiceError("forbidden", "Only the job owner or admin can accept or reject a response.", 403)

    try:
        resp = job.responses.get(pk=response_id)
    except Response.DoesNotExist:
        raise ServiceError("response_not_found", "Response not found.", 404)

    if job.status != JobRequest.Status.OPEN:
        raise ServiceError(
            "job_not_open",
            "Job is not open for accept or reject.",
            400,
        )

    if decision_status == Response.DecisionStatus.ACCEPTED:
        with transaction.atomic():
            resp.decision_status = Response.DecisionStatus.ACCEPTED
            resp.save(update_fields=["decision_status", "updated_at"])
            job.responses.exclude(pk=response_id).update(decision_status=Response.DecisionStatus.REJECTED)
            job.status = JobRequest.Status.ASSIGNED
            job.save(update_fields=["status", "updated_at"])
            ProviderProfile.objects.filter(user=resp.provider).update(
                completed_jobs_count=F("completed_jobs_count") + 1,
            )
    else:
        resp.decision_status = Response.DecisionStatus.REJECTED
        resp.save(update_fields=["decision_status", "updated_at"])

    logger.info(
        "accept_reject",
        extra={
            "request_id": request_id,
            "client_id": client_user.id,
            "job_id": job.id,
            "response_id": resp.id,
            "decision": decision_status,
        },
    )
    notify_provider_decision(resp, accepted=(decision_status == Response.DecisionStatus.ACCEPTED))
    return job, resp


def mark_job_responses_viewed(*, client_user, job_id, request_id=None):
    """
    If job belongs to client, set viewed_by_client_at=now for that job's responses where NULL.
    Returns count updated.
    """
    updated = Response.objects.filter(
        job_id=job_id,
        job__client=client_user,
        viewed_by_client_at__isnull=True,
    ).update(viewed_by_client_at=timezone.now())
    return updated


def _job_owner_or_admin(job, user):
    """True if user is the job owner or has admin role."""
    if job.client_id == getattr(user, "id", None):
        return True
    return getattr(user, "role", None) == "admin"


def update_job(*, client_user, job_id, data_dict, request_id=None):
    """
    Update a job. Only owner or admin. For MVP: only OPEN jobs can be edited.
    Returns the updated JobRequest. Raises ServiceError on failure.
    """
    request_id = request_id or ""
    try:
        job = JobRequest.objects.get(pk=job_id)
    except JobRequest.DoesNotExist:
        raise ServiceError("job_not_found", "Job not found.", 404)

    if not _job_owner_or_admin(job, client_user):
        raise ServiceError("forbidden", "Only the job owner or admin can edit this job.", 403)

    if job.status != JobRequest.Status.OPEN:
        raise ServiceError(
            "job_not_open",
            "Only open jobs can be edited.",
            400,
        )

    # response_price_credits is not updatable via PATCH (client or admin).
    allowed = (
        "title", "description", "category", "city",
        "budget_min_amd", "budget_max_amd", "deadline_date",
        "visibility",
    )
    update_fields = []
    for key in allowed:
        if key not in data_dict:
            continue
        val = data_dict[key]
        if key == "category" and val is not None and not isinstance(val, Category):
            val = Category.objects.filter(slug=val).first()
        if key == "city" and val is not None and not isinstance(val, City):
            val = City.objects.filter(slug=val).first()
        setattr(job, key, val)
        update_fields.append(key)
    if update_fields:
        job.save(update_fields=update_fields + ["updated_at"])
    logger.info(
        "job_updated",
        extra={"request_id": request_id, "client_id": job.client_id, "job_id": job.id},
    )
    return job


def _block_assigned_for_client(job, user):
    """Raise ServiceError 400 if job is ASSIGNED and user is not admin."""
    if job.status != JobRequest.Status.ASSIGNED:
        return
    if getattr(user, "role", None) == "admin":
        return
    raise ServiceError(
        "job_assigned",
        "Cannot cancel or delete an assigned job. Contact support if needed.",
        400,
    )


def cancel_job(*, client_user, job_id, request_id=None):
    """
    Cancel a job: set status=CANCELLED. Job remains in DB, visible to client, hidden from feed.
    Only owner or admin. Block if job is ASSIGNED unless admin.
    Returns the job. Raises ServiceError on failure.
    """
    request_id = request_id or ""
    try:
        job = JobRequest.objects.get(pk=job_id)
    except JobRequest.DoesNotExist:
        raise ServiceError("job_not_found", "Job not found.", 404)

    if not _job_owner_or_admin(job, client_user):
        raise ServiceError("forbidden", "Only the job owner or admin can cancel this job.", 403)

    _block_assigned_for_client(job, client_user)

    job.status = JobRequest.Status.CANCELLED
    job.save(update_fields=["status", "updated_at"])
    logger.info(
        "job_cancelled",
        extra={"request_id": request_id, "client_id": job.client_id, "job_id": job.id},
    )
    return job


def delete_job(*, client_user, job_id, request_id=None):
    """
    Soft-delete a job: set status=DELETED. Hidden from client list and provider feed.
    Only owner or admin. Block if job is ASSIGNED unless admin.
    Returns the job. Raises ServiceError on failure.
    """
    request_id = request_id or ""
    try:
        job = JobRequest.objects.get(pk=job_id)
    except JobRequest.DoesNotExist:
        raise ServiceError("job_not_found", "Job not found.", 404)

    if not _job_owner_or_admin(job, client_user):
        raise ServiceError("forbidden", "Only the job owner or admin can delete this job.", 403)

    _block_assigned_for_client(job, client_user)

    job.status = JobRequest.Status.DELETED
    job.save(update_fields=["status", "updated_at"])
    logger.info(
        "job_deleted",
        extra={"request_id": request_id, "client_id": job.client_id, "job_id": job.id},
    )
    return job


def reopen_job(*, client_user, job_id, request_id=None):
    """
    Reopen a cancelled job: set status=OPEN. Only owner or admin.
    Allowed only when job has no responses (MVP rule).
    Returns the job. Raises ServiceError on failure.
    """
    request_id = request_id or ""
    try:
        job = JobRequest.objects.get(pk=job_id)
    except JobRequest.DoesNotExist:
        raise ServiceError("job_not_found", "Job not found.", 404)

    if not _job_owner_or_admin(job, client_user):
        raise ServiceError("forbidden", "Only the job owner or admin can reopen this job.", 403)

    if job.status != JobRequest.Status.CANCELLED:
        raise ServiceError(
            "job_not_cancelled",
            "Only cancelled jobs can be reopened.",
            400,
        )

    if job.responses_count and job.responses_count > 0:
        raise ServiceError(
            "job_has_responses",
            "Cannot reopen a job that has responses.",
            400,
        )

    job.status = JobRequest.Status.OPEN
    job.save(update_fields=["status", "updated_at"])
    logger.info(
        "job_reopened",
        extra={"request_id": request_id, "client_id": job.client_id, "job_id": job.id},
    )
    return job


def restore_job(*, client_user, job_id, request_id=None):
    """
    Restore a deleted job: set status=OPEN. Only owner or admin.
    Returns the job. Raises ServiceError on failure.
    """
    request_id = request_id or ""
    try:
        job = JobRequest.objects.get(pk=job_id)
    except JobRequest.DoesNotExist:
        raise ServiceError("job_not_found", "Job not found.", 404)

    if not _job_owner_or_admin(job, client_user):
        raise ServiceError("forbidden", "Only the job owner or admin can restore this job.", 403)

    if job.status != JobRequest.Status.DELETED:
        raise ServiceError(
            "job_not_deleted",
            "Only deleted jobs can be restored.",
            400,
        )

    job.status = JobRequest.Status.OPEN
    job.save(update_fields=["status", "updated_at"])
    logger.info(
        "job_restored",
        extra={"request_id": request_id, "client_id": job.client_id, "job_id": job.id},
    )
    return job


def close_job(*, client_user, job_id, request_id=None):
    """
    Mark job as done: set status=CLOSED. Only owner or admin. Allowed only when job is ASSIGNED.
    Returns the job. Raises ServiceError on failure.
    """
    request_id = request_id or ""
    try:
        job = JobRequest.objects.get(pk=job_id)
    except JobRequest.DoesNotExist:
        raise ServiceError("job_not_found", "Job not found.", 404)

    if not _job_owner_or_admin(job, client_user):
        raise ServiceError("forbidden", "Only the job owner or admin can close this job.", 403)

    if job.status != JobRequest.Status.ASSIGNED:
        raise ServiceError(
            "job_not_assigned",
            "Only assigned jobs can be marked as done.",
            400,
        )

    job.status = JobRequest.Status.CLOSED
    job.save(update_fields=["status", "updated_at"])
    logger.info(
        "job_closed",
        extra={"request_id": request_id, "client_id": job.client_id, "job_id": job.id},
    )
    return job


def _recompute_provider_rating_avg(provider_id):
    """Update ProviderProfile.rating_avg for the given provider from ClientReview."""
    agg = ClientReview.objects.filter(provider_id=provider_id).aggregate(avg=Avg("rating"))
    avg = agg.get("avg")
    ProviderProfile.objects.filter(user_id=provider_id).update(
        rating_avg=round(avg, 2) if avg is not None else None
    )


def submit_review(*, client_user, job_id, rating, comment=None, request_id=None):
    """
    Create a single review for the job's accepted provider. Only job owner; job must be ASSIGNED or CLOSED.
    One review per job. Updates provider's rating_avg. Returns the ClientReview.
    """
    request_id = request_id or ""
    try:
        job = JobRequest.objects.get(pk=job_id)
    except JobRequest.DoesNotExist:
        raise ServiceError("job_not_found", "Job not found.", 404)

    if job.client_id != getattr(client_user, "id", None):
        raise ServiceError("forbidden", "Only the job owner can leave a review.", 403)

    if job.status not in (JobRequest.Status.ASSIGNED, JobRequest.Status.CLOSED):
        raise ServiceError(
            "job_not_reviewable",
            "You can only review providers for assigned or completed jobs.",
            400,
        )

    if not (1 <= rating <= 5):
        raise ServiceError("invalid_rating", "Rating must be between 1 and 5.", 400)

    accepted = job.responses.filter(decision_status=Response.DecisionStatus.ACCEPTED).first()
    if not accepted:
        raise ServiceError("no_accepted_response", "This job has no accepted provider to review.", 400)

    if ClientReview.objects.filter(job_id=job_id).exists():
        raise ServiceError("already_reviewed", "You have already left a review for this job.", 400)

    with transaction.atomic():
        review = ClientReview.objects.create(
            job=job,
            response=accepted,
            provider=accepted.provider,
            client=client_user,
            rating=rating,
            comment=(comment or "").strip()[:2000],
        )
        _recompute_provider_rating_avg(accepted.provider_id)

    logger.info(
        "review_submitted",
        extra={"request_id": request_id, "job_id": job.id, "provider_id": accepted.provider_id, "rating": rating},
    )
    return review
