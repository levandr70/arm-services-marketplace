from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods

from marketplace.exceptions import ServiceError
from marketplace.models import Category, City, JobRequest, ProviderProfile, Response
from marketplace.services import create_job, decide_response, mark_job_responses_viewed, submit_response

from .forms import CreateJobForm, LoginForm, RegisterForm, RespondForm


@require_http_methods(["GET", "POST"])
def register_view(request):
    if request.user.is_authenticated:
        return redirect("webui:login")
    if request.method == "GET":
        form = RegisterForm()
        return render(request, "webui/register.html", {"form": form})
    form = RegisterForm(request.POST)
    if not form.is_valid():
        return render(request, "webui/register.html", {"form": form})
    user = form.save()
    if user.role == "provider":
        ProviderProfile.objects.get_or_create(user=user, defaults={"company_name": ""})
    messages.success(request, "Registration successful. Please log in.")
    return redirect("webui:login")


@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        if request.user.role == "client" or request.user.role == "admin":
            return redirect("webui:client_dashboard")
        return redirect("webui:provider_dashboard")
    if request.method == "GET":
        form = LoginForm()
        return render(request, "webui/login.html", {"form": form})
    form = LoginForm(request.POST)
    if not form.is_valid():
        return render(request, "webui/login.html", {"form": form})
    email = form.cleaned_data["email"]
    password = form.cleaned_data["password"]
    user = authenticate(request, username=email, password=password)
    if user is None:
        messages.error(request, "Invalid email or password.")
        return render(request, "webui/login.html", {"form": form})
    login(request, user)
    if user.role == "client" or user.role == "admin":
        return redirect("webui:client_dashboard")
    return redirect("webui:provider_dashboard")


@require_http_methods(["GET", "POST"])
@login_required
def logout_view(request):
    logout(request)
    messages.success(request, "You have been logged out.")
    return redirect("webui:login")


@require_http_methods(["GET", "POST"])
@login_required
def client_dashboard(request):
    if request.user.role not in ("client", "admin"):
        messages.error(request, "Access denied.")
        return redirect("webui:login")
    jobs = JobRequest.objects.filter(client=request.user).order_by("-created_at")
    if request.method == "POST":
        form = CreateJobForm(request.POST)
        if form.is_valid():
            request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
            create_job(
                client_user=request.user,
                data_dict=form.cleaned_data,
                request_id=request_id,
            )
            messages.success(request, "Job created.")
            return redirect("webui:client_dashboard")
        messages.error(request, "Please fix the errors below.")
    else:
        form = CreateJobForm()
    return render(request, "webui/client_dashboard.html", {"jobs": jobs, "form": form})


@require_http_methods(["GET"])
@login_required
def client_job_detail(request, job_id):
    if request.user.role not in ("client", "admin"):
        messages.error(request, "Access denied.")
        return redirect("webui:login")
    job = get_object_or_404(JobRequest, pk=job_id, client=request.user)
    request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
    mark_job_responses_viewed(client_user=request.user, job_id=job.id, request_id=request_id)
    responses = job.responses.select_related("provider").order_by("-created_at")
    return render(request, "webui/client_job_detail.html", {"job": job, "responses": responses})


@require_http_methods(["POST"])
@login_required
def client_accept_reject(request, job_id):
    if request.user.role not in ("client", "admin"):
        messages.error(request, "Access denied.")
        return redirect("webui:login")
    job = get_object_or_404(JobRequest, pk=job_id, client=request.user)
    response_id = request.POST.get("response_id")
    decision = request.POST.get("decision_status")
    request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")

    try:
        job, resp = decide_response(
            client_user=request.user,
            job_id=job.id,
            response_id=response_id,
            decision_status=decision,
            request_id=request_id,
        )
    except ServiceError as e:
        messages.error(request, e.message)
        return redirect("webui:client_job_detail", job_id=job.id)

    if decision == "accepted":
        messages.success(request, "Response accepted. Job is now assigned.")
    else:
        messages.success(request, "Response rejected.")
    return redirect("webui:client_job_detail", job_id=job.id)


@require_http_methods(["GET"])
@login_required
def provider_dashboard(request):
    if request.user.role not in ("provider", "admin"):
        messages.error(request, "Access denied.")
        return redirect("webui:login")
    profile, _ = ProviderProfile.objects.get_or_create(user=request.user, defaults={"company_name": ""})
    qs = JobRequest.objects.filter(
        status=JobRequest.Status.OPEN,
        visibility__in=(JobRequest.Visibility.PUBLIC, JobRequest.Visibility.VERIFIED_ONLY),
    ).order_by("-created_at")
    category = request.GET.get("category", "").strip()
    city = request.GET.get("city", "").strip()
    budget_min = request.GET.get("budget_min_amd", "").strip()
    budget_max = request.GET.get("budget_max_amd", "").strip()
    if category:
        qs = qs.filter(category__slug=category)
    if city:
        qs = qs.filter(city__slug=city)
    if budget_min:
        try:
            v = int(budget_min)
            qs = qs.filter(Q(budget_max_amd__gte=v) | Q(budget_max_amd__isnull=True))
        except ValueError:
            pass
    if budget_max:
        try:
            v = int(budget_max)
            qs = qs.filter(Q(budget_min_amd__lte=v) | Q(budget_min_amd__isnull=True))
        except ValueError:
            pass
    responded_job_ids = set(
        Response.objects.filter(provider=request.user).values_list("job_id", flat=True)
    )
    category_choices = [(c.slug, c.name) for c in Category.objects.order_by("sort_order", "name")]
    city_choices = [(c.slug, c.name) for c in City.objects.order_by("sort_order", "name")]
    return render(request, "webui/provider_dashboard.html", {
        "credits_balance": profile.credits_balance,
        "verification_status": profile.verification_status,
        "jobs": qs,
        "responded_job_ids": responded_job_ids,
        "category_choices": category_choices,
        "city_choices": city_choices,
        "get_category": request.GET.get("category", ""),
        "get_city": request.GET.get("city", ""),
        "get_budget_min": request.GET.get("budget_min_amd", ""),
        "get_budget_max": request.GET.get("budget_max_amd", ""),
    })


@require_http_methods(["GET", "POST"])
@login_required
def provider_respond(request, job_id):
    if request.user.role not in ("provider", "admin"):
        messages.error(request, "Access denied.")
        return redirect("webui:login")
    job = get_object_or_404(JobRequest, pk=job_id)
    profile, _ = ProviderProfile.objects.get_or_create(user=request.user, defaults={"company_name": ""})
    form = RespondForm(request.POST or None)
    if request.method != "POST" or not form.is_valid():
        return render(request, "webui/provider_respond.html", {
            "job": job,
            "form": form or RespondForm(),
            "credits_balance": profile.credits_balance,
        })

    request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
    try:
        submit_response(
            provider_user=request.user,
            job_id=job_id,
            payload_dict=form.cleaned_data,
            request_id=request_id,
        )
    except ServiceError as e:
        messages.error(request, e.message)
        if e.code in ("insufficient_credits", "exception"):
            return redirect("webui:provider_respond", job_id=job_id)
        return redirect("webui:provider_dashboard")

    messages.success(request, "Response submitted successfully.")
    return redirect("webui:provider_dashboard")
