from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .serializers import RegisterSerializer, UserSerializer


class CurrentUserView(APIView):
    """GET /api/auth/me/ - return current user (email, role, is_client, is_provider, etc.) when authenticated with JWT."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class EnableProviderView(APIView):
    """
    POST /api/auth/enable-provider/ - enable provider mode for the current user.
    Sets is_provider=True and creates ProviderProfile if missing. Returns updated me payload.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        user.is_provider = True
        user.save(update_fields=["is_provider"])

        # Create ProviderProfile if missing (lazy import to avoid circular import)
        from marketplace.models import ProviderProfile

        ProviderProfile.objects.get_or_create(
            user=user,
            defaults={"company_name": "", "verification_status": "pending"},
        )

        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )
