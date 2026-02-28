from django.shortcuts import redirect
from django.urls import path

from . import views

app_name = "webui"


def app_root(request):
    return redirect("webui:login")


urlpatterns = [
    path("", app_root),
    path("register/", views.register_view, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("client/", views.client_dashboard, name="client_dashboard"),
    path("client/jobs/<int:job_id>/", views.client_job_detail, name="client_job_detail"),
    path("client/jobs/<int:job_id>/accept-reject/", views.client_accept_reject, name="client_accept_reject"),
    path("provider/", views.provider_dashboard, name="provider_dashboard"),
    path("provider/jobs/<int:job_id>/respond/", views.provider_respond, name="provider_respond"),
]
