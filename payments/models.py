from django.conf import settings
from django.db import models


class CreditTransaction(models.Model):
    class Type(models.TextChoices):
        GRANT = "grant", "Grant"
        PURCHASE = "purchase", "Purchase"
        USAGE = "usage", "Usage"
        REFUND = "refund", "Refund"

    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="credit_transactions",
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    amount = models.IntegerField()  # signed: positive for grant/purchase/refund, negative for usage
    balance_after = models.IntegerField()
    related_response = models.ForeignKey(
        "marketplace.Response",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_transactions",
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payments_credit_transaction"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type} {self.amount} for {self.provider.email}"
