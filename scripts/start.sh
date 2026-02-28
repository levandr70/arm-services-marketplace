#!/usr/bin/env bash
# Run migrations, optionally create superuser (if env vars set), then start Gunicorn.
# Used on Render free tier where Shell is not available.
set -e
python manage.py migrate --noinput
# Create superuser only if DJANGO_SUPERUSER_EMAIL is set. Ignore error if user already exists.
if [ -n "${DJANGO_SUPERUSER_EMAIL}" ]; then
  python manage.py createsuperuser --noinput 2>/dev/null || true
fi
exec gunicorn core.wsgi --bind 0.0.0.0:${PORT:-8000}
