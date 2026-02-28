class ServiceError(Exception):
    """Raised by marketplace services; carries code, user-facing message, and HTTP status."""

    def __init__(self, code: str, message: str, http_status: int = 400):
        self.code = code
        self.message = message
        self.http_status = http_status
        super().__init__(message)


def service_error_to_drf_response(exc: "ServiceError"):
    """Convert ServiceError to a DRF Response. Use in DRF views."""
    from rest_framework.response import Response
    return Response({"detail": exc.message}, status=exc.http_status)


def service_error_to_message_and_redirect(request, exc: "ServiceError", redirect_url_name, redirect_kwargs=None):
    """Add exc.message to request as messages.error and return redirect. Use in Django view."""
    from django.contrib import messages
    from django.shortcuts import redirect
    messages.error(request, exc.message)
    return redirect(redirect_url_name, **(redirect_kwargs or {}))
