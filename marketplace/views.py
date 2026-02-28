from django.db.models import Q
from django.http import Http404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import ServiceError, service_error_to_drf_response
from .models import Category, City, ClientReview, JobRequest, ProviderProfile, Response as ResponseModel
from .pagination import MarketplacePageNumberPagination
from .permissions import IsClient, IsJobClient, IsProvider
from .serializers import (
    ChatMessageSerializer,
    JobRequestCreateSerializer,
    JobRequestDetailSerializer,
    JobRequestFeedDetailSerializer,
    JobRequestListSerializer,
    JobRequestUpdateSerializer,
    ProviderProfileSerializer,
    PublicExecutorSerializer,
    PublicJobListSerializer,
    PublicReviewSerializer,
    ReviewListSerializer,
    ResponseSerializer,
    ResponseSubmitSerializer,
    ResponseUpdateSerializer,
)
from .services import (
    cancel_job,
    close_job,
    create_job,
    decide_response,
    delete_job,
    mark_job_responses_viewed,
    reopen_job,
    restore_job,
    submit_review,
    submit_response,
    update_job,
    withdraw_response,
)


class JobRequestViewSet(viewsets.ModelViewSet):
    """
    Client: create job, list my jobs, view job with responses, accept/reject response, edit/cancel own job.
    """
    permission_classes = [IsClient, IsJobClient]
    pagination_class = MarketplacePageNumberPagination

    def get_queryset(self):
        qs = JobRequest.objects.select_related("client").prefetch_related(
            "responses",
            "responses__provider",
            "responses__provider__provider_profile",
            "client_review",
        )
        if getattr(self.request.user, "role", None) == "admin":
            return qs
        client_qs = qs.filter(client=self.request.user)
        # Retrieve: include deleted so client can view and restore.
        if self.action == "retrieve":
            return client_qs
        # List: filter by status if provided; default excludes deleted.
        status_param = self.request.query_params.get("status")
        if status_param == "deleted":
            return client_qs.filter(status=JobRequest.Status.DELETED)
        if status_param:
            statuses = [s.strip().lower() for s in status_param.split(",") if s.strip()]
            if statuses:
                return client_qs.filter(status__in=statuses)
        return client_qs.exclude(status=JobRequest.Status.DELETED)

    def get_serializer_class(self):
        if self.action == "list":
            return JobRequestListSerializer
        if self.action == "create":
            return JobRequestCreateSerializer
        if self.action in ("update", "partial_update"):
            return JobRequestUpdateSerializer
        return JobRequestDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        job = self.get_object()
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        mark_job_responses_viewed(client_user=request.user, job_id=job.id, request_id=request_id)
        serializer = self.get_serializer(job)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        job = create_job(
            client_user=request.user,
            data_dict=serializer.validated_data,
            request_id=request_id,
        )
        return Response(
            JobRequestDetailSerializer(job).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        try:
            job = JobRequest.objects.get(pk=kwargs["pk"])
        except JobRequest.DoesNotExist:
            raise Http404("No JobRequest matches the given query.")
        serializer = JobRequestUpdateSerializer(instance=job, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        try:
            job = update_job(
                client_user=request.user,
                job_id=job.id,
                data_dict=serializer.validated_data,
                request_id=request_id,
            )
        except ServiceError as e:
            return service_error_to_drf_response(e)
        return Response(JobRequestDetailSerializer(job).data)

    def destroy(self, request, *args, **kwargs):
        try:
            job = JobRequest.objects.get(pk=kwargs["pk"])
        except JobRequest.DoesNotExist:
            raise Http404("No JobRequest matches the given query.")
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        try:
            job = delete_job(
                client_user=request.user,
                job_id=job.id,
                request_id=request_id,
            )
        except ServiceError as e:
            return service_error_to_drf_response(e)
        return Response({"ok": True, "status": job.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="cancel", permission_classes=[IsClient, IsJobClient])
    def cancel(self, request, pk=None):
        try:
            job = JobRequest.objects.get(pk=pk)
        except JobRequest.DoesNotExist:
            raise Http404("No JobRequest matches the given query.")
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        try:
            job = cancel_job(
                client_user=request.user,
                job_id=job.id,
                request_id=request_id,
            )
        except ServiceError as e:
            return service_error_to_drf_response(e)
        return Response({"ok": True, "status": job.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reopen", permission_classes=[IsClient, IsJobClient])
    def reopen(self, request, pk=None):
        try:
            job = JobRequest.objects.get(pk=pk)
        except JobRequest.DoesNotExist:
            raise Http404("No JobRequest matches the given query.")
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        try:
            job = reopen_job(
                client_user=request.user,
                job_id=job.id,
                request_id=request_id,
            )
        except ServiceError as e:
            return service_error_to_drf_response(e)
        return Response({"ok": True, "status": job.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restore", permission_classes=[IsClient, IsJobClient])
    def restore(self, request, pk=None):
        try:
            job = JobRequest.objects.get(pk=pk)
        except JobRequest.DoesNotExist:
            raise Http404("No JobRequest matches the given query.")
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        try:
            job = restore_job(
                client_user=request.user,
                job_id=job.id,
                request_id=request_id,
            )
        except ServiceError as e:
            return service_error_to_drf_response(e)
        return Response({"ok": True, "status": job.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="accept-reject", permission_classes=[IsClient, IsJobClient])
    def accept_reject(self, request, pk=None):
        job = self.get_object()
        decision = request.data.get("decision_status")
        response_id = request.data.get("response_id")
        if not decision or not response_id:
            return Response(
                {"detail": "decision_status and response_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            response_id = int(response_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "response_id must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
            return service_error_to_drf_response(e)

        return Response({
            "response": ResponseSerializer(resp).data,
            "job_status": job.status,
        })

    @action(detail=True, methods=["post"], url_path="close", permission_classes=[IsClient, IsJobClient])
    def close(self, request, pk=None):
        try:
            job = JobRequest.objects.get(pk=pk)
        except JobRequest.DoesNotExist:
            raise Http404("No JobRequest matches the given query.")
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        try:
            job = close_job(
                client_user=request.user,
                job_id=job.id,
                request_id=request_id,
            )
        except ServiceError as e:
            return service_error_to_drf_response(e)
        return Response({"ok": True, "status": job.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="review", permission_classes=[IsClient, IsJobClient])
    def review(self, request, pk=None):
        job = self.get_object()
        rating = request.data.get("rating")
        comment = request.data.get("comment") or ""
        if rating is None:
            return Response(
                {"detail": "rating is required (1-5)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            rating = int(rating)
        except (TypeError, ValueError):
            return Response(
                {"detail": "rating must be an integer between 1 and 5."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        try:
            review = submit_review(
                client_user=request.user,
                job_id=job.id,
                rating=rating,
                comment=comment,
                request_id=request_id,
            )
        except ServiceError as e:
            return service_error_to_drf_response(e)
        return Response(
            {"rating": review.rating, "comment": review.comment, "created_at": review.created_at.isoformat()},
            status=status.HTTP_201_CREATED,
        )


class JobFeedViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Provider: list open jobs only (feed). Optional ?category= &city= &search=. Retrieve returns single job detail.
    """
    permission_classes = [IsProvider]
    pagination_class = MarketplacePageNumberPagination

    def get_queryset(self):
        qs = (
            JobRequest.objects.filter(
                status=JobRequest.Status.OPEN,
                visibility__in=(JobRequest.Visibility.PUBLIC, JobRequest.Visibility.VERIFIED_ONLY),
                moderation_status=JobRequest.ModerationStatus.APPROVED,
            )
            .select_related("category", "city")
            .order_by("-created_at")
        )
        if self.action != "list":
            return qs
        # Providers should not see tasks they have already responded to in their feed.
        user = getattr(self.request, "user", None)
        if user and getattr(user, "is_authenticated", False):
          taken_ids = ResponseModel.objects.filter(provider=user).values_list("job_id", flat=True)
          qs = qs.exclude(id__in=taken_ids)
        category = (self.request.query_params.get("category") or "").strip()
        if category:
            qs = qs.filter(category__slug=category)
        city = (self.request.query_params.get("city") or "").strip()
        if city:
            qs = qs.filter(city__slug=city)
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return JobRequestFeedDetailSerializer
        return JobRequestListSerializer


class PublicTasksViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public: list and retrieve open tasks (no auth). For "Find tasks" page.
    GET /api/tasks/ — paginated list, optional ?category= &city= &search=
    GET /api/tasks/{id}/ — single task detail (same fields as feed detail).
    """
    permission_classes = [AllowAny]
    pagination_class = MarketplacePageNumberPagination

    def get_queryset(self):
        qs = (
            JobRequest.objects.filter(
                status=JobRequest.Status.OPEN,
                visibility__in=(JobRequest.Visibility.PUBLIC, JobRequest.Visibility.VERIFIED_ONLY),
                moderation_status=JobRequest.ModerationStatus.APPROVED,
            )
            .select_related("category", "city")
            .order_by("-created_at")
        )
        # When a provider is authenticated, hide tasks they have already responded to
        # so that "Find tasks" only shows new opportunities for them.
        user = getattr(self.request, "user", None)
        if user and getattr(user, "is_authenticated", False) and getattr(user, "is_provider", False):
          taken_ids = ResponseModel.objects.filter(provider=user).values_list("job_id", flat=True)
          qs = qs.exclude(id__in=taken_ids)
        category = (self.request.query_params.get("category") or "").strip()
        if category:
            qs = qs.filter(category__slug=category)
        city = (self.request.query_params.get("city") or "").strip()
        if city:
            qs = qs.filter(city__slug=city)
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return JobRequestFeedDetailSerializer
        return PublicJobListSerializer


class ResponseViewSet(viewsets.ModelViewSet):
    """
    Provider: submit response (POST), list my responses (filter by status), retrieve, partial_update (pending only), withdraw.
    """
    permission_classes = [IsProvider]
    pagination_class = MarketplacePageNumberPagination

    def get_queryset(self):
        qs = ResponseModel.objects.filter(provider=self.request.user).select_related("job", "provider")
        status_param = (self.request.query_params.get("status") or "").strip().lower()
        if status_param:
            statuses = [s for s in status_param.split(",") if s.strip() in ("pending", "accepted", "rejected")]
            if statuses:
                qs = qs.filter(decision_status__in=statuses)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return ResponseSubmitSerializer
        if self.action in ("partial_update", "update"):
            return ResponseUpdateSerializer
        return ResponseSerializer

    def create(self, request, *args, **kwargs):
        job_id = request.data.get("job_id")
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")

        try:
            response_obj = submit_response(
                provider_user=request.user,
                job_id=job_id,
                payload_dict=request.data,
                request_id=request_id,
            )
        except ServiceError as e:
            return service_error_to_drf_response(e)

        return Response(
            ResponseSerializer(response_obj).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.job.status != JobRequest.Status.OPEN:
            return Response(
                {"detail": "Cannot edit: job is no longer open."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.decision_status != ResponseModel.DecisionStatus.PENDING:
            return Response(
                {"detail": "Cannot edit: response was already accepted or rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ResponseUpdateSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ResponseSerializer(instance).data)

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="withdraw")
    def withdraw(self, request, pk=None):
        request_id = getattr(request, "request_id", None) or request.META.get("REQUEST_ID", "")
        try:
            withdraw_response(provider_user=request.user, response_id=int(pk), request_id=request_id)
        except ServiceError as e:
            return service_error_to_drf_response(e)
        return Response({"ok": True, "detail": "Response withdrawn."}, status=status.HTTP_200_OK)

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=["get", "post"], url_path="messages", permission_classes=[IsProvider, IsClient])
    def messages(self, request, pk=None):
        """
        GET: list chat messages for this response (only job client and provider can access).
        POST: create a new message with {"text": "..."}.
        """
        try:
            resp = ResponseModel.objects.select_related("job", "provider").get(pk=pk)
        except ResponseModel.DoesNotExist:
            return Response({"detail": "Response not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        is_client = getattr(resp.job, "client_id", None) == getattr(user, "id", None)
        is_provider = getattr(resp, "provider_id", None) == getattr(user, "id", None)
        if not (is_client or is_provider):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        if request.method.lower() == "get":
            messages_qs = resp.chat_messages.all().order_by("created_at")
            data = ChatMessageSerializer(messages_qs, many=True).data
            return Response(data)

        # POST
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "Text is required."}, status=status.HTTP_400_BAD_REQUEST)
        msg = resp.chat_messages.create(sender=user, text=text)
        return Response(ChatMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class CreditsBalanceViewSet(viewsets.ViewSet):
    permission_classes = [IsProvider]

    def list(self, request):
        from payments.models import CreditTransaction
        profile, _ = ProviderProfile.objects.get_or_create(
            user=request.user,
            defaults={"company_name": ""},
        )
        transactions = list(
            CreditTransaction.objects.filter(provider=request.user)
            .order_by("-created_at")[:50]
            .values("type", "amount", "balance_after", "note", "created_at", "related_response_id")
        )
        for t in transactions:
            if t.get("created_at"):
                t["created_at"] = t["created_at"].isoformat()
        return Response({
            "credits_balance": profile.credits_balance,
            "transactions": transactions,
        })


class ProviderProfileView(APIView):
    """GET/POST/PATCH /api/provider-profile/ — provider's own profile (singleton). POST creates profile if missing."""
    permission_classes = [IsProvider]

    def get(self, request):
        profile, _ = ProviderProfile.objects.get_or_create(
            user=request.user,
            defaults={"company_name": ""},
        )
        return Response(ProviderProfileSerializer(profile).data)

    def post(self, request):
        """Create or ensure profile exists; accept initial data (same as PATCH). Returns 201 when created."""
        profile, created = ProviderProfile.objects.get_or_create(
            user=request.user,
            defaults={"company_name": ""},
        )
        serializer = ProviderProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            ProviderProfileSerializer(profile).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def patch(self, request):
        profile, _ = ProviderProfile.objects.get_or_create(
            user=request.user,
            defaults={"company_name": ""},
        )
        serializer = ProviderProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PublicExecutorProfileView(APIView):
    """GET /api/executors/<user_id>/ — public read-only executor profile. AllowAny."""
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        from accounts.models import User
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise Http404("Executor not found.")
        try:
            profile = user.provider_profile
        except ProviderProfile.DoesNotExist:
            raise Http404("Executor not found.")
        data = {
            "id": user.id,
            "full_name": user.full_name or "",
            "city": user.city or "",
            "company_name": profile.company_name or "",
            "description": profile.description or "",
            "tags": profile.tags or [],
            "portfolio": profile.portfolio or [],
            "verification_status": profile.verification_status or "pending",
            "completed_jobs_count": profile.completed_jobs_count or 0,
            "rating_avg": profile.rating_avg,
        }
        serializer = PublicExecutorSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)


class CategoriesListView(APIView):
    """GET /api/categories/ — list categories (slug, name, sort_order). AllowAny."""
    permission_classes = [AllowAny]

    def get(self, request):
        items = list(
            Category.objects.values("slug", "name", "sort_order").order_by("sort_order", "name")
        )
        return Response(items)


class CitiesListView(APIView):
    """GET /api/cities/ — list cities (slug, name, sort_order). AllowAny."""
    permission_classes = [AllowAny]

    def get(self, request):
        items = list(
            City.objects.values("slug", "name", "sort_order").order_by("sort_order", "name")
        )
        return Response(items)


class PublicReviewsView(APIView):
    """GET /api/public-reviews/ — last N client reviews about executors. AllowAny."""

    permission_classes = [AllowAny]

    def get(self, request):
        limit = 6
        reviews = (
            ClientReview.objects.select_related(
                "job",
                "provider",
                "provider__provider_profile",
            )
            .order_by("-created_at")[:limit]
        )
        items = []
        for r in reviews:
            job = getattr(r, "job", None)
            provider = getattr(r, "provider", None)
            profile = getattr(provider, "provider_profile", None) if provider else None

            title = getattr(job, "title", "") or "Untitled"
            # Budget string similar to frontend budget helper
            min_b = getattr(job, "budget_min_amd", None)
            max_b = getattr(job, "budget_max_amd", None)
            if min_b is not None and max_b is not None:
                price_str = f"{min_b} – {max_b} AMD"
            elif min_b is not None:
                price_str = f"From {min_b} AMD"
            elif max_b is not None:
                price_str = f"Up to {max_b} AMD"
            else:
                price_str = ""

            executor_name = ""
            if provider:
                executor_name = getattr(provider, "full_name", "") or getattr(provider, "email", "") or ""

            completed = 0
            if profile:
                completed = getattr(profile, "completed_jobs_count", 0) or 0

            created_at = getattr(r, "created_at", None)
            # Use ISO date string; frontend can format nicely
            date_str = created_at.date().isoformat() if created_at else ""

            items.append(
                {
                    "taskTitle": title,
                    "foundIn": "Found via marketplace",
                    "price": price_str,
                    "review": (r.comment or "").strip(),
                    "date": date_str,
                    "executorName": executor_name or "Executor",
                    "rating": float(r.rating),
                    "completedTasks": int(completed),
                }
            )

        serializer = PublicReviewSerializer(items, many=True)
        return Response(serializer.data)


class ReviewsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public: paginated list of client reviews with optional ?search=<executor_name>.
    """

    permission_classes = [AllowAny]
    pagination_class = MarketplacePageNumberPagination
    serializer_class = ReviewListSerializer

    def get_queryset(self):
        qs = (
            ClientReview.objects.select_related(
                "job",
                "provider",
                "provider__provider_profile",
            )
            .order_by("-created_at")
        )
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(provider__full_name__icontains=search)
                | Q(provider__email__icontains=search)
                | Q(provider__provider_profile__company_name__icontains=search)
            )
        category = (self.request.query_params.get("category") or "").strip()
        if category:
            qs = qs.filter(job__category__slug=category)
        min_rating = (self.request.query_params.get("min_rating") or "").strip()
        if min_rating:
            try:
                min_val = float(min_rating)
                qs = qs.filter(rating__gte=min_val)
            except ValueError:
                pass
        max_rating = (self.request.query_params.get("max_rating") or "").strip()
        if max_rating:
            try:
                max_val = float(max_rating)
                qs = qs.filter(rating__lte=max_val)
            except ValueError:
                pass
        return qs
