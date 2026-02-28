import logging

from django.contrib import admin, messages
from django.db import transaction
from django.shortcuts import redirect
from django.urls import reverse

from payments.models import CreditTransaction

from .models import Category, City, ClientReview, JobRequest, MarketplaceSettings, ProviderProfile, Response, get_marketplace_settings

logger = logging.getLogger(__name__)


def _grant_credits_to_provider_profiles(queryset, amount: int, note: str):
    """Create CreditTransaction and update ProviderProfile.credits_balance for each selected profile. Call inside atomic if needed."""
    created = 0
    for profile in queryset.select_related("user"):
        with transaction.atomic():
            profile.credits_balance += amount
            profile.save(update_fields=["credits_balance"])
            CreditTransaction.objects.create(
                provider=profile.user,
                type=CreditTransaction.Type.GRANT,
                amount=amount,
                balance_after=profile.credits_balance,
                note=note,
            )
            created += 1
    return created


def grant_credits_to_providers(modeladmin, request, queryset):
    """Grant 10 credits to selected providers and create a CreditTransaction for each."""
    amount = 10
    created = _grant_credits_to_provider_profiles(queryset, amount, "Admin grant")
    messages.success(request, f"Granted {amount} credits to {created} provider(s).")


grant_credits_to_providers.short_description = "Grant 10 credits to selected providers"


def add_100_credits(modeladmin, request, queryset):
    """Add 100 credits to selected providers (test top-up). Creates a GRANT CreditTransaction and updates balance."""
    amount = 100
    created = _grant_credits_to_provider_profiles(queryset, amount, "Admin top-up (test)")
    messages.success(request, f"Added {amount} credits to {created} provider(s).")


add_100_credits.short_description = "Add 100 credits"


def set_verification_verified(modeladmin, request, queryset):
    n = queryset.update(verification_status=ProviderProfile.VerificationStatus.VERIFIED)
    messages.success(request, f"Set verification to Verified for {n} profile(s).")


set_verification_verified.short_description = "Set verification to Verified"


def set_verification_pending(modeladmin, request, queryset):
    n = queryset.update(verification_status=ProviderProfile.VerificationStatus.PENDING)
    messages.success(request, f"Set verification to Pending for {n} profile(s).")


set_verification_pending.short_description = "Set verification to Pending"


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "sort_order")
    list_editable = ("name", "sort_order")
    search_fields = ("slug", "name")
    ordering = ("sort_order", "name")


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "sort_order")
    list_editable = ("name", "sort_order")
    search_fields = ("slug", "name")
    ordering = ("sort_order", "name")


@admin.register(MarketplaceSettings)
class MarketplaceSettingsAdmin(admin.ModelAdmin):
    list_display = ("default_response_price_credits",)
    readonly_fields = ("key",)

    def has_add_permission(self, request):
        return not MarketplaceSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        try:
            obj = get_marketplace_settings()
        except Exception as e:
            logger.exception("MarketplaceSettings get_marketplace_settings failed: %s", e)
            try:
                has_any = MarketplaceSettings.objects.exists()
            except Exception:
                has_any = False
            if not has_any:
                return redirect(reverse("admin:marketplace_marketplacesettings_add"))
            messages.error(request, "Could not load marketplace settings. Check server logs.")
            return redirect(reverse("admin:index"))
        return redirect(reverse("admin:marketplace_marketplacesettings_change", args=(obj.pk,)))


@admin.register(ProviderProfile)
class ProviderProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "company_name", "verification_status", "credits_balance", "completed_jobs_count", "rating_avg")
    list_filter = ("verification_status",)
    search_fields = ("company_name", "user__email", "user__first_name", "user__last_name")
    raw_id_fields = ("user",)
    actions = [grant_credits_to_providers, add_100_credits, set_verification_verified, set_verification_pending]


def approve_jobs(modeladmin, request, queryset):
    """Mark selected jobs as approved for publication."""
    updated = queryset.update(moderation_status=JobRequest.ModerationStatus.APPROVED)
    messages.success(request, f"Approved {updated} job(s) for publication.")


approve_jobs.short_description = "Approve selected jobs"


def reject_jobs(modeladmin, request, queryset):
    """Mark selected jobs as rejected (hidden from providers/visitors)."""
    updated = queryset.update(moderation_status=JobRequest.ModerationStatus.REJECTED)
    messages.success(request, f"Marked {updated} job(s) as rejected.")


reject_jobs.short_description = "Reject selected jobs"


@admin.register(JobRequest)
class JobRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "client",
        "category",
        "city",
        "status",
        "moderation_status",
        "visibility",
        "responses_count",
        "created_at",
    )
    list_filter = ("status", "moderation_status", "visibility", "category", "city")
    search_fields = ("title", "description", "client__email")
    raw_id_fields = ("client",)
    list_per_page = 25
    date_hierarchy = "created_at"
    actions = [approve_jobs, reject_jobs]


def refund_response_fee(modeladmin, request, queryset):
    """Refund response fee (credits only): set payment_status=refunded, add credits back, create CreditTransaction."""
    request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
    refunded = 0
    for resp in queryset.select_related("provider"):
        if resp.payment_status != Response.PaymentStatus.PAID:
            continue
        with transaction.atomic():
            resp.payment_status = Response.PaymentStatus.REFUNDED
            resp.save(update_fields=["payment_status"])
            profile, _ = ProviderProfile.objects.get_or_create(
                user=resp.provider,
                defaults={"company_name": ""},
            )
            profile.credits_balance += resp.response_fee_credits
            profile.save(update_fields=["credits_balance"])
            CreditTransaction.objects.create(
                provider=resp.provider,
                type=CreditTransaction.Type.REFUND,
                amount=resp.response_fee_credits,
                balance_after=profile.credits_balance,
                related_response=resp,
                note=f"Refund for response #{resp.id}",
            )
            logger.info(
                "refund",
                extra={
                    "request_id": request_id,
                    "provider_id": resp.provider_id,
                    "response_id": resp.id,
                    "amount": resp.response_fee_credits,
                },
            )
            refunded += 1
    messages.success(request, f"Refunded credits for {refunded} response(s).")


refund_response_fee.short_description = "Refund response fee (credits)"


@admin.register(Response)
class ResponseAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "provider", "decision_status", "payment_status", "response_fee_credits", "created_at")
    list_filter = ("decision_status", "payment_status")
    search_fields = ("job__title", "provider__email", "cover_message")
    raw_id_fields = ("job", "provider")
    list_per_page = 25
    date_hierarchy = "created_at"
    actions = [refund_response_fee]


@admin.register(ClientReview)
class ClientReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "provider", "client", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = ("job__title", "provider__email", "client__email", "comment")
    raw_id_fields = ("job", "response", "provider", "client")
    readonly_fields = ("created_at",)
