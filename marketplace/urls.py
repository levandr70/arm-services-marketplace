from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CategoriesListView,
    CitiesListView,
    CreditsBalanceViewSet,
    JobFeedViewSet,
    JobRequestViewSet,
    ProviderProfileView,
    PublicExecutorProfileView,
    PublicReviewsView,
    PublicTasksViewSet,
    ResponseViewSet,
    ReviewsViewSet,
)

router = DefaultRouter()
router.register(r"jobs", JobRequestViewSet, basename="job")
router.register(r"feed", JobFeedViewSet, basename="feed")
router.register(r"tasks", PublicTasksViewSet, basename="task")
router.register(r"my-responses", ResponseViewSet, basename="my-response")
router.register(r"credits", CreditsBalanceViewSet, basename="credits")
router.register(r"reviews", ReviewsViewSet, basename="review")

urlpatterns = [
    path("provider-profile/", ProviderProfileView.as_view(), name="provider-profile"),
    path("executors/<int:user_id>/", PublicExecutorProfileView.as_view(), name="public-executor"),
    path("categories/", CategoriesListView.as_view(), name="categories"),
    path("cities/", CitiesListView.as_view(), name="cities"),
    path("public-reviews/", PublicReviewsView.as_view(), name="public-reviews"),
    path("", include(router.urls)),
]
