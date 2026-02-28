from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        extra_fields.setdefault("is_client", True)
        extra_fields.setdefault("is_provider", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    objects = UserManager()
    class Role(models.TextChoices):
        CLIENT = "client", "Client"
        PROVIDER = "provider", "Provider"
        ADMIN = "admin", "Admin"

    username = None
    email = models.EmailField("email address", unique=True)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True)
    city = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CLIENT)
    # Capability flags: one user can be both client and provider. Permissions use these instead of role.
    is_client = models.BooleanField(default=True)
    is_provider = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        db_table = "accounts_user"

    def __str__(self):
        return self.email
