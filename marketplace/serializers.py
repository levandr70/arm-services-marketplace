from rest_framework import serializers

from accounts.serializers import UserSerializer
from .models import Category, City, ChatMessage, ClientReview, JobRequest, ProviderProfile, Response, get_marketplace_settings


class ProviderProfileSerializer(serializers.ModelSerializer):
    """GET/PATCH for provider's own profile. verification_status read-only for provider."""

    verification_status = serializers.ReadOnlyField()

    class Meta:
        model = ProviderProfile
        fields = (
            "company_name",
            "description",
            "tags",
            "portfolio",
            "verification_status",
            "completed_jobs_count",
            "rating_avg",
            "credits_balance",
        )
        read_only_fields = ("credits_balance", "completed_jobs_count", "rating_avg")
        extra_kwargs = {
            "company_name": {"required": False, "allow_blank": True},
            "description": {"required": False, "allow_blank": True},
            "tags": {"required": False},
            "portfolio": {"required": False},
        }


class PublicExecutorSerializer(serializers.Serializer):
    """Read-only public profile for an executor (by user id). No email or credits."""

    id = serializers.IntegerField()
    full_name = serializers.CharField()
    city = serializers.CharField()
    company_name = serializers.CharField()
    description = serializers.CharField()
    tags = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    portfolio = serializers.ListField(allow_empty=True)
    verification_status = serializers.CharField()
    completed_jobs_count = serializers.IntegerField()
    rating_avg = serializers.FloatField(allow_null=True)


class PublicReviewSerializer(serializers.Serializer):
    """Public review card for homepage: last client reviews about executors."""

    taskTitle = serializers.CharField()
    foundIn = serializers.CharField()
    price = serializers.CharField()
    review = serializers.CharField()
    date = serializers.CharField()
    executorName = serializers.CharField()
    rating = serializers.FloatField()
    completedTasks = serializers.IntegerField()


class ReviewListSerializer(serializers.ModelSerializer):
    """Paginated review listing for dedicated reviews page."""

    taskTitle = serializers.CharField(source="job.title", read_only=True)
    executorName = serializers.SerializerMethodField()
    completedTasks = serializers.SerializerMethodField()

    class Meta:
        model = ClientReview
        fields = (
            "id",
            "taskTitle",
            "rating",
            "comment",
            "created_at",
            "executorName",
            "completedTasks",
        )

    def get_executorName(self, obj):
        provider = getattr(obj, "provider", None)
        if not provider:
            return ""
        full_name = getattr(provider, "full_name", "") or ""
        if full_name:
            return full_name
        email = getattr(provider, "email", "") or ""
        return email

    def get_completedTasks(self, obj):
        provider = getattr(obj, "provider", None)
        if not provider:
            return 0
        profile = getattr(provider, "provider_profile", None)
        if not profile:
            return 0
        return getattr(profile, "completed_jobs_count", 0) or 0


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serialize chat messages for a specific response."""

    sender_role = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ("id", "text", "created_at", "sender_role")

    def get_sender_role(self, obj):
        sender = getattr(obj, "sender", None)
        response = getattr(obj, "response", None)
        if not sender or not response:
          return "unknown"
        job = getattr(response, "job", None)
        if job and getattr(job, "client_id", None) == getattr(sender, "id", None):
          return "client"
        if getattr(response, "provider_id", None) == getattr(sender, "id", None):
          return "provider"
        return "unknown"


class JobRequestListSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True, allow_null=True)
    city = serializers.SlugRelatedField(slug_field="slug", read_only=True, allow_null=True)
    accepted_provider_name = serializers.SerializerMethodField()

    class Meta:
        model = JobRequest
        fields = (
            "id",
            "title",
            "category",
            "city",
            "status",
            "moderation_status",
            "response_price_credits",
            "responses_count",
            "created_at",
            "accepted_provider_name",
        )

    def get_accepted_provider_name(self, obj):
        if (getattr(obj, "status", None) or "").lower() != "assigned":
            return None
        accepted = next(
            (r for r in (getattr(obj, "responses", None).all() or []) if getattr(r, "decision_status", None) == Response.DecisionStatus.ACCEPTED),
            None,
        )
        if not accepted or not getattr(accepted, "provider", None):
            return None
        try:
            return getattr(accepted.provider.provider_profile, "company_name", None) or getattr(accepted.provider, "email", "")
        except (ProviderProfile.DoesNotExist, AttributeError):
            return getattr(accepted.provider, "email", "") or ""


class JobRequestFeedDetailSerializer(serializers.ModelSerializer):
    """Read-only job detail for provider feed (single job). Includes description, budget, deadline."""
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True, allow_null=True)
    city = serializers.SlugRelatedField(slug_field="slug", read_only=True, allow_null=True)

    class Meta:
        model = JobRequest
        fields = (
            "id",
            "title",
            "description",
            "category",
            "city",
            "status",
            "budget_min_amd",
            "budget_max_amd",
            "deadline_date",
            "response_price_credits",
            "responses_count",
            "created_at",
        )


class PublicJobListSerializer(serializers.ModelSerializer):
    """List item for public task listing (no auth). No client or accepted_provider."""
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True, allow_null=True)
    city = serializers.SlugRelatedField(slug_field="slug", read_only=True, allow_null=True)

    class Meta:
        model = JobRequest
        fields = (
            "id",
            "title",
            "category",
            "city",
            "budget_min_amd",
            "budget_max_amd",
            "deadline_date",
            "responses_count",
            "created_at",
        )


class JobRequestCreateSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(
        queryset=Category.objects.all(), slug_field="slug", required=False, allow_null=True
    )
    city = serializers.SlugRelatedField(
        queryset=City.objects.all(), slug_field="slug", required=False, allow_null=True
    )

    class Meta:
        model = JobRequest
        fields = (
            "title",
            "description",
            "category",
            "city",
            "budget_min_amd",
            "budget_max_amd",
            "deadline_date",
            "visibility",
            "response_price_credits",
        )
        extra_kwargs = {
            "response_price_credits": {"required": False},
            "budget_min_amd": {"required": False},
            "budget_max_amd": {"required": False},
            "deadline_date": {"required": False},
            "visibility": {"required": False, "default": JobRequest.Visibility.PUBLIC},
        }

    def create(self, validated_data):
        validated_data["client"] = self.context["request"].user
        if validated_data.get("response_price_credits") is None:
            validated_data["response_price_credits"] = get_marketplace_settings().default_response_price_credits
        if validated_data.get("category") is None:
            validated_data["category"] = Category.objects.filter(slug="other").first()
        if validated_data.get("city") is None:
            validated_data["city"] = City.objects.filter(slug="other").first()
        return super().create(validated_data)


class JobRequestUpdateSerializer(serializers.ModelSerializer):
    """Partial update; all fields optional. response_price_credits is not editable by clients."""
    category = serializers.SlugRelatedField(
        queryset=Category.objects.all(), slug_field="slug", required=False, allow_null=True
    )
    city = serializers.SlugRelatedField(
        queryset=City.objects.all(), slug_field="slug", required=False, allow_null=True
    )

    class Meta:
        model = JobRequest
        fields = (
            "title",
            "description",
            "category",
            "city",
            "budget_min_amd",
            "budget_max_amd",
            "deadline_date",
            "visibility",
        )
        extra_kwargs = {f: {"required": False} for f in (
            "title", "description", "category", "city",
            "budget_min_amd", "budget_max_amd", "deadline_date",
            "visibility",
        )}

    def validate(self, attrs):
        min_b = attrs.get("budget_min_amd")
        max_b = attrs.get("budget_max_amd")
        if min_b is not None and max_b is not None and min_b > max_b:
            raise serializers.ValidationError(
                {"budget_max_amd": "budget_max_amd must be >= budget_min_amd."}
            )
        return attrs


def _get_provider_profile(response_obj):
    try:
        return response_obj.provider.provider_profile
    except (ProviderProfile.DoesNotExist, AttributeError):
        return None


def _response_rank_key(response_obj):
    """Sort key for ranking: verified first, then completed_jobs_count, rating_avg, then newest."""
    profile = _get_provider_profile(response_obj)
    verified = 0 if (profile and getattr(profile, "verification_status", None) == "verified") else 1
    completed = getattr(profile, "completed_jobs_count", 0) or 0
    rating = getattr(profile, "rating_avg", None)
    rating_val = float(rating) if rating is not None else 0.0
    created = getattr(response_obj, "created_at", None)
    created_ts = created.timestamp() if created else 0
    return (verified, -completed, -rating_val, -created_ts)


class ResponseSerializer(serializers.ModelSerializer):
    provider_email = serializers.SerializerMethodField()
    provider_company = serializers.SerializerMethodField()
    job_id = serializers.SerializerMethodField()
    job_title = serializers.SerializerMethodField()
    badges = serializers.SerializerMethodField()

    class Meta:
        model = Response
        fields = (
            "id",
            "job_id",
            "job_title",
            "provider",
            "provider_email",
            "provider_company",
            "proposed_price_amd",
            "timeline_text",
            "cover_message",
            "decision_status",
            "response_fee_credits",
            "created_at",
            "badges",
        )
        read_only_fields = ("provider", "response_fee_credits", "payment_status")

    def get_provider_email(self, obj):
        provider = getattr(obj, "provider", None)
        return getattr(provider, "email", "") or ""

    def get_provider_company(self, obj):
        provider = getattr(obj, "provider", None)
        if not provider:
            return ""
        try:
            return provider.provider_profile.company_name
        except (ProviderProfile.DoesNotExist, AttributeError):
            return ""

    def get_job_id(self, obj):
        return getattr(obj, "job_id", None)

    def get_job_title(self, obj):
        job = getattr(obj, "job", None)
        return getattr(job, "title", "") or "" if job else ""

    def get_badges(self, obj):
        """Badges: verified, top_rated (completed_jobs_count >= 5), fast_responder (response within 2h of job)."""
        badges = []
        profile = _get_provider_profile(obj)
        if profile and getattr(profile, "verification_status", None) == "verified":
            badges.append("verified")
        if profile and (getattr(profile, "completed_jobs_count", 0) or 0) >= 5:
            badges.append("top_rated")
        job = getattr(obj, "job", None)
        if job and getattr(obj, "created_at", None) and getattr(job, "created_at", None):
            delta = (obj.created_at - job.created_at).total_seconds()
            if 0 <= delta <= 7200:  # 2 hours
                badges.append("fast_responder")
        return badges


class ResponseSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Response
        fields = ("proposed_price_amd", "timeline_text", "cover_message")

    def validate(self, attrs):
        job = self.context["job"]
        attrs["response_fee_credits"] = job.response_price_credits
        return attrs


class ResponseUpdateSerializer(serializers.ModelSerializer):
    """PATCH: only cover_message, proposed_price_amd, timeline_text. All optional."""

    class Meta:
        model = Response
        fields = ("cover_message", "proposed_price_amd", "timeline_text")
        extra_kwargs = {
            "cover_message": {"required": False, "allow_blank": True},
            "proposed_price_amd": {"required": False, "allow_null": True},
            "timeline_text": {"required": False, "allow_blank": True},
        }


class JobRequestDetailSerializer(serializers.ModelSerializer):
    responses = serializers.SerializerMethodField()
    accepted_response = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()
    my_review = serializers.SerializerMethodField()
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True, allow_null=True)
    city = serializers.SlugRelatedField(slug_field="slug", read_only=True, allow_null=True)

    class Meta:
        model = JobRequest
        fields = (
            "id",
            "title",
            "description",
            "category",
            "city",
            "budget_min_amd",
            "budget_max_amd",
            "deadline_date",
            "status",
            "visibility",
            "moderation_status",
            "moderation_note",
            "response_price_credits",
            "responses_count",
            "created_at",
            "updated_at",
            "responses",
            "accepted_response",
            "can_review",
            "my_review",
        )

    def get_responses(self, obj):
        """Return responses sorted by rank: verified first, then completed_jobs_count, rating_avg, then newest."""
        responses = list(getattr(obj, "responses", None).all() or [])
        responses.sort(key=_response_rank_key)
        return ResponseSerializer(responses, many=True).data

    def get_accepted_response(self, obj):
        """Return the accepted response (id, provider_email, provider_company) or None."""
        try:
            responses = getattr(obj, "responses", None)
            if responses is None:
                return None
            accepted = next(
                (r for r in responses.all() if getattr(r, "decision_status", None) == Response.DecisionStatus.ACCEPTED),
                None,
            )
            if not accepted:
                return None
            provider = getattr(accepted, "provider", None)
            company = ""
            if provider:
                try:
                    company = getattr(provider.provider_profile, "company_name", "") or ""
                except (ProviderProfile.DoesNotExist, AttributeError):
                    pass
            return {
                "id": getattr(accepted, "id", None),
                "provider_email": getattr(provider, "email", "") or "",
                "provider_company": company,
            }
        except Exception:
            return None

    def get_can_review(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return False
        if obj.client_id != getattr(request.user, "id", None):
            return False
        status_val = (getattr(obj, "status", None) or "").lower()
        if status_val not in ("assigned", "closed"):
            return False
        if ClientReview.objects.filter(job_id=obj.id).exists():
            return False
        return True

    def get_my_review(self, obj):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return None
        try:
            review = obj.client_review
        except ClientReview.DoesNotExist:
            return None
        if review.client_id != getattr(request.user, "id", None):
            return None
        return {
            "rating": review.rating,
            "comment": review.comment or "",
            "created_at": review.created_at.isoformat() if review.created_at else None,
        }


class JobRequestAcceptRejectSerializer(serializers.Serializer):
    decision_status = serializers.ChoiceField(choices=Response.DecisionStatus.choices)
