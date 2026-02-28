import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def safe_send_mail(subject, message, recipient_list, fail_silently=True, **kwargs):
    """Send email; on failure log warning and do not raise (best-effort)."""
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=kwargs.get("from_email") or settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            fail_silently=fail_silently,
            **{k: v for k, v in kwargs.items() if k != "from_email"},
        )
    except Exception as e:
        logger.warning("Email send failed: %s", e, exc_info=True, extra={"subject": subject, "recipients": recipient_list})


def notify_client_new_offer(job):
    """Notify job client that a new offer was submitted (best-effort)."""
    if not job or not job.client or not getattr(job.client, "email", None):
        return
    link_path = f"/app/client/jobs/{job.id}/"
    subject = "New offer on your job"
    message = f"A new offer was submitted for your job: {job.title}\n\nView it here: {link_path}"
    safe_send_mail(subject, message, [job.client.email])


def notify_provider_decision(response, accepted):
    """Notify provider that their offer was accepted or rejected (best-effort)."""
    if not response or not response.provider or not getattr(response.provider, "email", None):
        return
    job = getattr(response, "job", None)
    job_title = job.title if job else "your job"
    decision = "accepted" if accepted else "rejected"
    subject = f"Your offer was {decision}"
    message = f"Your offer for the job \"{job_title}\" was {decision}."
    safe_send_mail(subject, message, [response.provider.email])
