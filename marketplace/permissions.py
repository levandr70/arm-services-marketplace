from rest_framework import permissions


def _user_role(request):
    """Safe role access; returns None if user has no role (e.g. TokenUser without claim)."""
    if not getattr(request, "user", None):
        return None
    return getattr(request.user, "role", None)


def _is_admin_or_staff(user):
    """True if user is admin (role) or staff. Used for bypass on capability checks."""
    if not user:
        return False
    return getattr(user, "is_staff", False) or getattr(user, "role", None) == "admin"


class IsClient(permissions.BasePermission):
    """Allow if user has client capability or is admin/staff."""

    def has_permission(self, request, view):
        if not getattr(request, "user", None) or not request.user.is_authenticated:
            return False
        user = request.user
        if _is_admin_or_staff(user):
            return True
        return getattr(user, "is_client", False)


class IsProvider(permissions.BasePermission):
    """Allow if user has provider capability or is admin."""

    def has_permission(self, request, view):
        if not getattr(request, "user", None) or not request.user.is_authenticated:
            return False
        user = request.user
        if _is_admin_or_staff(user):
            return True
        return getattr(user, "is_provider", False)


class IsJobClient(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        user_id = getattr(user, "id", None)
        if user_id is not None and obj.client_id == user_id:
            return True
        return _user_role(request) == "admin"
