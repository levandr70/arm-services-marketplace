from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Used for /api/auth/me/ and registration response. Includes capability flags and optional provider info."""

    provider_verification_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "phone",
            "city",
            "role",
            "is_client",
            "is_provider",
            "provider_verification_status",
        )
        read_only_fields = ("id", "email", "role", "is_client", "is_provider")

    def get_provider_verification_status(self, obj):
        if not getattr(obj, "pk", None):
            return None
        try:
            return obj.provider_profile.verification_status
        except Exception:
            return None


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("email", "password", "full_name", "phone", "city", "role")

    def validate_role(self, value):
        if value not in (User.Role.CLIENT, User.Role.PROVIDER):
            raise serializers.ValidationError("Role must be client or provider.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        role = validated_data.get("role", User.Role.CLIENT)
        validated_data.setdefault("is_client", True)
        validated_data.setdefault("is_provider", role == User.Role.PROVIDER)
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save(update_fields=["password"])
        return user
