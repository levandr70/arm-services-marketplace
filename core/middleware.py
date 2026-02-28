import logging
import uuid

logger = logging.getLogger(__name__)


class RequestIDMiddleware:
    """Inject request_id (uuid4) into request and log it for tracing."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = str(uuid.uuid4())
        request.META["REQUEST_ID"] = request_id
        request.request_id = request_id
        logger.info("request_id=%s path=%s", request_id, request.path, extra={"request_id": request_id})
        response = self.get_response(request)
        return response
