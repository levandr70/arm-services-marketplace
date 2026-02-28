from django.urls import path

from . import views
from .jwt_views import EmailTokenObtainPairView

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("me/", views.CurrentUserView.as_view(), name="current_user"),
    path("enable-provider/", views.EnableProviderView.as_view(), name="enable_provider"),
]
