from django.contrib import admin

from .models import CreditTransaction


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "provider", "amount", "type", "balance_after", "created_at")
    list_filter = ("type",)
    search_fields = ("provider__email", "note")
    raw_id_fields = ("provider", "related_response")
    readonly_fields = ("created_at",)
