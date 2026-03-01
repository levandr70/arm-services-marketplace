# Deployment Guide – Armenia Services Marketplace

This guide helps you deploy the app with **minimal budget** (testing stage). All options below can be **free or nearly free** for low traffic.

---

## Quick summary – your steps

1. **Backend (Render):** New Web Service → connect repo → set **Root** to repo root → Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput` → Start: `bash scripts/start.sh` → Add env vars (`SECRET_KEY`, `DEBUG=0`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`; optional: `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD`, `DJANGO_SUPERUSER_FULL_NAME` for admin on free tier) → Deploy (migrations and superuser run automatically).
2. **Frontend (Vercel):** Import repo → set **Root Directory** to `frontend` → Add env `NEXT_PUBLIC_API_BASE_URL` = your Render backend URL → Deploy.
3. **CORS:** Set `CORS_ALLOWED_ORIGINS` on backend to your Vercel URL (e.g. `https://your-app.vercel.app`).

**Note:** On Render’s free tier the backend **spins down** after ~15 min of no traffic; the first request after that may take 30–60 seconds to wake up.

---

## Minimal budget recommendation

| Component   | Suggested host        | Cost        | Notes |
|------------|------------------------|------------|-------|
| **Frontend** (Next.js) | [Vercel](https://vercel.com) | **Free**   | Generous free tier, zero config for Next.js |
| **Backend** (Django)   | [Render](https://render.com) | **Free**   | Free Web Service (spins down after 15 min inactivity) |
| **Database**           | SQLite (default) or Render PostgreSQL | **Free** | Leave `DB_NAME` unset = SQLite (no extra service). For PostgreSQL use Render’s free Postgres |

**Total: $0/month** for testing. When you need always-on backend or more traffic, consider a paid plan (~$7/month Render) or alternatives below.

---

## Prerequisites

- Git repo (GitHub / GitLab) with this project
- Accounts: [Vercel](https://vercel.com/signup), [Render](https://render.com/register)

---

## Part 1: Deploy backend (Django) on Render

### 1. Push your code

Ensure the repo has the project root (with `manage.py`, `requirements.txt`, `Procfile`, `core/`).

### 2. Create a Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**.
2. Connect your Git repo and select it.
3. Configure:
   - **Name:** `arm-marketplace-api` (or any name).
   - **Region:** Choose closest to your users.
   - **Root Directory:** leave empty (repo root).
   - **Runtime:** Python 3.
   - **Build Command:**
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput
     ```
   - **Start Command:**
     ```bash
     bash scripts/start.sh
     ```
     This runs migrations, optionally creates a superuser (if env vars below are set), then starts Gunicorn. No Shell needed on free tier.
     (Alternative: `python manage.py migrate --noinput && gunicorn core.wsgi --bind 0.0.0.0:$PORT` if you don’t need auto superuser.)
   - **Instance Type:** Free.

### 3. Environment variables (Backend)

In Render → your Web Service → **Environment** → **Add Environment Variable**:

| Key | Value | Required |
|-----|--------|----------|
| `SECRET_KEY` | A long random string (e.g. from [djecrety](https://djecrety.ir/) or `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`) | Yes |
| `DEBUG` | `0` | Yes |
| `ALLOWED_HOSTS` | `your-service-name.onrender.com` (replace with your Render URL, no `https://`) | Yes |
| `CORS_ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` (your Vercel URL; add more comma-separated if needed) | Yes |
| `SECURE_SSL_REDIRECT` | `1` | Recommended |

**Optional – create Django admin user on free tier (no Shell):**  
Add these so the start script can create a superuser automatically. Our User model uses **email** and **full_name**:

| Key | Value |
|-----|--------|
| `DJANGO_SUPERUSER_EMAIL` | Your admin email (e.g. `admin@example.com`) |
| `DJANGO_SUPERUSER_PASSWORD` | A strong password for the admin user |
| `DJANGO_SUPERUSER_FULL_NAME` | Display name (e.g. `Admin`) |

If these are set, the first deploy (or first start after DB reset) will create that user. Later starts skip creation if the user already exists.

**For database:**

- **SQLite (simplest, free):** Do **not** set `DB_NAME`. Render’s free tier has ephemeral disk, so data resets on deploy. Fine for testing.
- **PostgreSQL (persistent):** In Render create a **PostgreSQL** database, then add:
  - `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` from the database’s **Internal Connection String** (use “Internal” so backend and DB are in same network).

Save. Render will redeploy.

### 4. Migrations and superuser (first time)

- **If you use the start script** (`bash scripts/start.sh`) and set `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD`, and `DJANGO_SUPERUSER_FULL_NAME`: migrations and superuser creation run automatically on every deploy. No Shell needed (works on free tier).
- **If you prefer Shell:** upgrade to a plan with Shell access, then run `python manage.py migrate` and `python manage.py createsuperuser` once.

If you use **SQLite**, the shell may not persist the same filesystem as the web process; for production persistence use PostgreSQL.

### 5. Note your backend URL

Example: `https://arm-marketplace-api.onrender.com`. You will use this for the frontend.

---

## Part 2: Deploy frontend (Next.js) on Vercel

### 1. Import project on Vercel

1. Go to [Vercel](https://vercel.com) → **Add New** → **Project**.
2. Import your Git repo.
3. **Root Directory:** set to `frontend` (so Vercel builds the Next.js app).
4. **Framework Preset:** Next.js (auto-detected).

### 2. Environment variables (Frontend)

In Vercel → Project → **Settings** → **Environment Variables** add:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://your-backend.onrender.com` (no trailing slash) |

Use the same value for Production, Preview, and Development if you want.

### 3. Deploy

Click **Deploy**. Vercel will build and give you a URL like `https://your-project.vercel.app`.

### 4. Update backend CORS

In Render → Backend service → **Environment**, set:

- `CORS_ALLOWED_ORIGINS` = `https://your-project.vercel.app` (and any custom domains you add later).

Redeploy the backend if needed so CORS allows your frontend origin.

---

## Your deployment checklist

- [ ] Backend on Render: build = `pip install -r requirements.txt && python manage.py collectstatic --noinput`, start = `bash scripts/start.sh`
- [ ] Backend env: `SECRET_KEY`, `DEBUG=0`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `SECURE_SSL_REDIRECT=1`; optional: `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD`, `DJANGO_SUPERUSER_FULL_NAME` for admin user on free tier
- [ ] Database: either SQLite (no `DB_NAME`) or Render Postgres with `DB_*` set
- [ ] Migrations (and superuser if env vars set) run via start script; or use Shell once if upgraded
- [ ] Frontend on Vercel with root directory = `frontend`
- [ ] Frontend env: `NEXT_PUBLIC_API_BASE_URL` = your backend URL
- [ ] CORS includes your frontend URL

---

## Ongoing development: making changes and deploying

You **don’t have to run the app locally** to deploy. Push to GitHub and Render + Vercel will redeploy. Running locally is optional and useful for fast feedback while coding.

### Option A: Develop locally (recommended for day-to-day work)

1. **Backend:** In the project root, activate the venv and run:
   ```bash
   .venv\Scripts\activate
   python manage.py runserver
   ```
2. **Frontend:** In `frontend/`, run:
   ```bash
   npm run dev
   ```
3. **Frontend talks to local backend** if `frontend/.env.local` has `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` (default). No need to keep production open.
4. Make your code changes, test in the browser, then push to deploy (see below).

### Option B: Deploy without running locally

1. Edit code in your repo (backend in project root, frontend in `frontend/`).
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your message"
   git push origin main
   ```
3. **Render** (backend) and **Vercel** (frontend) are connected to the same repo:
   - **Render** builds from the **repo root** and redeploys the backend.
   - **Vercel** builds from the **`frontend`** folder and redeploys the frontend.
4. Wait a few minutes; both will update. No need to run the app locally.

### Summary

| Goal | What to do |
|------|------------|
| Code and test quickly | Run backend + frontend **locally** (runserver + npm run dev), use `.env.local` for API URL. |
| Update production | **Push to `main`**; Render and Vercel auto-deploy. You don’t need to run the app or keep any browser tab open. |
| Backend-only change | Push → only Render redeploys. |
| Frontend-only change | Push → only Vercel redeploys. |
| Both changed | One push → both redeploy. |

You do **not** need to keep the backend or frontend open in a browser for deploys to work.

---

## Optional: other hosts

- **Railway** – Free tier ($5 credit/month). Deploy backend + optional Postgres; frontend can also run on Railway or keep on Vercel.
- **Fly.io** – Free allowance for small VMs. Good if you want always-on backend without Render spin-down.
- **Netlify** – Alternative to Vercel for frontend (also free tier).

---

## Local production-style run (optional)

**Backend:**

```bash
cd C:\dev\arm-services-marketplace
.venv\Scripts\activate
set DEBUG=0
set ALLOWED_HOSTS=localhost,127.0.0.1
set CORS_ALLOWED_ORIGINS=http://localhost:3000
pip install -r requirements.txt
python manage.py collectstatic --noinput
gunicorn core.wsgi --bind 0.0.0.0:8000
```

**Frontend:**

```bash
cd frontend
set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
npm run build
npm start
```

---

## Troubleshooting

- **Bad Gateway (502) from Render:**  
  - **Cold start (most common):** On the free tier the service sleeps after ~15 minutes of no traffic. The **first request** after that can return "Bad Gateway" or "Service unavailable" for **30–90 seconds** while the instance starts. **Wait 1–2 minutes and try again** (or hit the API root or `/api/health/` until it responds).  
  - **Check Render dashboard:** Open your Web Service → **Logs** and **Events**. If the last deploy failed (build or start), you’ll see errors there. Fix build command, start command, or env vars and redeploy.  
  - **Env vars:** Ensure `ALLOWED_HOSTS` includes your Render host (e.g. `arm-marketplace-api.onrender.com`). If you use PostgreSQL, ensure `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` are set (or use Render’s “Internal Database URL” and map it to these vars).  
  - **Health check (optional):** In Render → Service → **Settings** → **Health Check Path**, set `/api/health/`. Render will poll that URL to know when the app is ready and may reduce 502s during deploys.

- **CORS errors in browser:** Ensure `CORS_ALLOWED_ORIGINS` exactly matches the frontend origin (scheme + host, no trailing slash), and backend was redeployed after changing env.
- **502 / App failed to start:** Check Render logs. Ensure `PORT` is used (Render sets it); start command must be `gunicorn core.wsgi --bind 0.0.0.0:$PORT`.
- **Static files (admin):** `collectstatic` runs at build; WhiteNoise serves static. If admin CSS is missing, confirm build command includes `python manage.py collectstatic --noinput`.
- **SQLite on Render:** Free instances have ephemeral storage; data is lost on redeploy. Use PostgreSQL for persistent data.
