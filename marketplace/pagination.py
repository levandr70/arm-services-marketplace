from rest_framework.pagination import PageNumberPagination


class MarketplacePageNumberPagination(PageNumberPagination):
    page_size = 20
