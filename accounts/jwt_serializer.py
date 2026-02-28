from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Token obtain pair; compatible with User.USERNAME_FIELD = 'email' (no field rename)."""

    def validate(self, attrs):
        data = super().validate(attrs)
        user = getattr(self, "user", None)
        if user is not None:
            data["role"] = getattr(user, "role", "client")
            data["is_client"] = getattr(user, "is_client", True)
            data["is_provider"] = getattr(user, "is_provider", False)
        return data
