# Armenia Services Marketplace – MVP Backend

Django + DRF + PostgreSQL + SimpleJWT backend. Clients post job requests for free; providers pay 1 credit per response. No public provider directory.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env     # edit DB and SECRET_KEY
```

**Database:** Set `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` in `.env` for PostgreSQL. Leave `DB_NAME` unset to use SQLite.

```bash
python manage.py migrate
python manage.py createsuperuser  # email + password
python manage.py runserver
```

## API Overview

- **Auth:** `POST /api/auth/register/`, `POST /api/auth/token/` (body: `email`, `password`), `POST /api/auth/refresh/` (body: `refresh`).
- **Clients (role=client):**
  - `POST /api/jobs/` – create job
  - `GET /api/jobs/` – my jobs
  - `GET /api/jobs/<id>/` – job detail with responses (marks responses as viewed)
  - `POST /api/jobs/<id>/accept-reject/` – body: `{"response_id": 1, "decision_status": "accepted"|"rejected"}`
- **Providers (role=provider):**
  - `GET /api/feed/` – open jobs feed
  - `POST /api/my-responses/` – submit response (body: `job_id`, `proposed_price_amd`, `timeline_text`, `cover_message`); deducts credits atomically
  - `GET /api/my-responses/` – my responses
  - `GET /api/credits/` – credits balance

All API (except register/token) require `Authorization: Bearer <access_token>`.

## Admin

`/admin/` – register/login with superuser. On **Provider profiles**, use action **Grant 10 credits to selected providers** to add credits and create a `CreditTransaction` (type=grant).

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for minimal-budget deployment (Vercel + Render, free tier) and step-by-step instructions.
