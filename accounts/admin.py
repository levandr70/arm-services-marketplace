from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "full_name", "role", "is_client", "is_provider", "city", "is_staff")
    list_filter = ("role", "is_client", "is_provider", "is_staff")
    search_fields = ("email", "full_name")
    ordering = ("email",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "phone", "city", "role", "is_client", "is_provider")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )
    add_fieldsets = (
        (None, {"fields": ("email", "password1", "password2")}),
        ("Profile", {"fields": ("full_name", "phone", "city", "role", "is_client", "is_provider")}),
    )
