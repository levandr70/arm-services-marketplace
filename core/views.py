from django.http import JsonResponse


def root(request):
    """Root URL: list main entry points."""
    return JsonResponse({
        "message": "Armenia Services Marketplace API",
        "admin": "/admin/",
        "api": {
            "auth": "/api/auth/register/",
            "token": "/api/auth/token/",
            "jobs": "/api/jobs/",
            "feed": "/api/feed/",
            "my-responses": "/api/my-responses/",
            "credits": "/api/credits/",
        },
    })


def health(request):
    """GET /api/health/ -> {"ok": true}."""
    return JsonResponse({"ok": True})
