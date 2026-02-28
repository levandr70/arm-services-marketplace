from django.conf import settings
from django.db import models
from django.db.utils import OperationalError, ProgrammingError


class MarketplaceSettings(models.Model):
    """Singleton: only one row. Use get_or_create with key='global'."""
    key = models.CharField(max_length=32, unique=True, default="global", editable=False)
    default_response_price_credits = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "marketplace_marketplace_settings"
        verbose_name = "Marketplace settings"
        verbose_name_plural = "Marketplace settings"

    def __str__(self):
        return "Marketplace settings"


def get_marketplace_settings():
    try:
        obj, _ = MarketplaceSettings.objects.get_or_create(
            key="global",
            defaults={"default_response_price_credits": 1},
        )
        return obj
    except (OperationalError, ProgrammingError):
        from rest_framework.exceptions import APIException
        raise APIException(
            detail="MarketplaceSettings table not ready. Run migrations.",
            code="marketplace_settings_not_ready",
        )


class ProviderProfile(models.Model):
    """Provider profile: bio, categories (tags), portfolio, verification, trust stats."""

    class VerificationStatus(models.TextChoices):
        NONE = "none", "None"
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="provider_profile",
    )
    company_name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)  # bio
    tags = models.JSONField(default=list, blank=True)  # service categories e.g. ["plumbing", "electrical"]
    verification_status = models.CharField(
        max_length=50,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    credits_balance = models.IntegerField(default=0)
    portfolio = models.JSONField(default=list, blank=True)  # [{"url": "...", "title": "..."}]
    completed_jobs_count = models.PositiveIntegerField(default=0)
    rating_avg = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "marketplace_provider_profile"

    def __str__(self):
        return f"{self.company_name} ({self.user.email})"


# Reference models (managed in Django admin). Legacy choice tuples kept for migrations.
class Category(models.Model):
    """Job category. Managed in Django admin."""
    slug = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "marketplace_category"
        ordering = ["sort_order", "name"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class City(models.Model):
    """City/location. Managed in Django admin."""
    slug = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "marketplace_city"
        ordering = ["sort_order", "name"]
        verbose_name_plural = "Cities"

    def __str__(self):
        return self.name


# Legacy (for migrations only)
CATEGORY_CHOICES = [
    ("plumbing", "Plumbing"),
    ("electrical", "Electrical"),
    ("cleaning", "Cleaning"),
    ("repair", "Repair"),
    ("construction", "Construction"),
    ("other", "Other"),
]
CITY_CHOICES = [
    ("yerevan", "Yerevan"),
    ("gyumri", "Gyumri"),
    ("vanadzor", "Vanadzor"),
    ("abovyan", "Abovyan"),
    ("ejmiatsin", "Ejmiatsin"),
    ("other", "Other"),
]


class JobRequest(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ASSIGNED = "assigned", "Assigned"
        CLOSED = "closed", "Closed"
        CANCELLED = "cancelled", "Cancelled"
        DELETED = "deleted", "Deleted"

    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        DRAFT = "draft", "Draft"
        VERIFIED_ONLY = "verified_only", "Verified only"

    class ModerationStatus(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_requests",
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="jobs",
        null=True,
        blank=True,
    )
    city = models.ForeignKey(
        City,
        on_delete=models.PROTECT,
        related_name="jobs",
        null=True,
        blank=True,
    )
    budget_min_amd = models.PositiveIntegerField(null=True, blank=True)
    budget_max_amd = models.PositiveIntegerField(null=True, blank=True)
    deadline_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
    )
    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING,
    )
    moderation_note = models.TextField(blank=True)
    response_price_credits = models.PositiveIntegerField(default=1)
    responses_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "marketplace_job_request"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Response(models.Model):
    class PaymentStatus(models.TextChoices):
        PAID = "paid", "Paid"
        REFUNDED = "refunded", "Refunded"

    class DecisionStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    job = models.ForeignKey(
        JobRequest,
        on_delete=models.CASCADE,
        related_name="responses",
    )
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_responses",
    )
    proposed_price_amd = models.PositiveIntegerField(null=True, blank=True)
    timeline_text = models.TextField(blank=True)
    cover_message = models.TextField(blank=True)
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PAID,
    )
    response_fee_credits = models.PositiveIntegerField(default=1)
    viewed_by_client_at = models.DateTimeField(null=True, blank=True)
    decision_status = models.CharField(
        max_length=20,
        choices=DecisionStatus.choices,
        default=DecisionStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "marketplace_response"
        ordering = ["-created_at"]
        unique_together = [["job", "provider"]]

    def __str__(self):
        return f"Response by {self.provider.email} for {self.job.title}"


class ClientReview(models.Model):
    """One review per job: client rates the accepted provider after job is assigned/closed."""
    job = models.OneToOneField(
        JobRequest,
        on_delete=models.CASCADE,
        related_name="client_review",
    )
    response = models.OneToOneField(
        Response,
        on_delete=models.CASCADE,
        related_name="client_review",
    )
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_received",
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_given",
    )
    rating = models.PositiveSmallIntegerField()  # 1-5
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "marketplace_client_review"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Review {self.rating}/5 for job #{self.job_id} by {self.client.email}"


class ChatMessage(models.Model):
    """Chat message between client and provider for a specific job response."""

    response = models.ForeignKey(
        Response,
        on_delete=models.CASCADE,
        related_name="chat_messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_messages",
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "marketplace_chat_message"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"ChatMessage #{self.id} for response #{self.response_id}"
