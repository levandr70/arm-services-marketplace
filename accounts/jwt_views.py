from rest_framework import serializers
from rest_framework_simplejwt.views import TokenObtainPairView
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer, OpenApiResponse

from .jwt_serializer import EmailTokenObtainPairSerializer


@extend_schema_view(
    post=extend_schema(
        request=inline_serializer(
            "TokenObtainRequest",
            fields={
                "email": serializers.EmailField(write_only=True, help_text="User email (USERNAME_FIELD)"),
                "password": serializers.CharField(write_only=True, style={"input_type": "password"}),
            },
        ),
        responses={
            200: inline_serializer(
                "TokenObtainResponse",
                fields={
                    "access": serializers.CharField(read_only=True),
                    "refresh": serializers.CharField(read_only=True),
                    "email": serializers.EmailField(read_only=True, required=False),
                    "role": serializers.CharField(read_only=True, required=False),
                },
            ),
            401: OpenApiResponse(
                response=inline_serializer(
                    "TokenObtainError",
                    fields={"detail": serializers.CharField()},
                ),
                description="No active account found with the given credentials",
            ),
        },
        description="Obtain JWT access and refresh tokens using email and password.",
    ),
)
class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
