# Deploy backend to Railway and connect the frontend

**Paste-ready steps.** Replace only the placeholders in the checklist below, then copy-paste the values into Railway and Vercel.

---

## Before you start – fill this checklist once

Replace the placeholders and keep the values handy. You’ll paste them in later steps.

| # | What to fill | Example (replace with yours) |
|---|----------------|------------------------------|
| 1 | **SECRET_KEY** | Run in terminal (see below) and paste the output here. |
| 2 | **Your frontend URL** (Vercel app URL, no trailing slash) | `https://arm-marketplace.vercel.app` |
| 3 | **Admin email** | `admin@example.com` |
| 4 | **Admin password** | A strong password you choose |
| 5 | **Admin display name** | `Admin` |

**To get SECRET_KEY:** open PowerShell or terminal and run:

```powershell
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Copy the long string it prints (e.g. `a1b2c3d4e5...`) and use it as **SECRET_KEY** in the checklist above.

---

# Part 1: Deploy backend on Railway

---

## Step 1: Open Railway and create a project

1. Go to **https://railway.app**
2. Click **Login** → sign in with **GitHub**
3. Click **New Project**

---

## Step 2: Add the backend from GitHub

1. Click **Deploy from GitHub repo** (or **Add service** → **GitHub repo**)
2. If asked, authorize Railway to access GitHub
3. Select the repo: **levandr70/arm-services-marketplace** (or your repo name)
4. Leave **Root Directory** empty
5. Leave **Branch** as **main** (or your default branch)
6. Railway will create a service and start a deploy (it may fail once until we add variables – that’s OK)

---

## Step 3: Add PostgreSQL

1. In the same project, click **+ New** (top right or in the project view)
2. Click **Database**
3. Click **Add PostgreSQL**
4. Wait until the PostgreSQL service shows **Running** (green)
5. **Connect it to the backend:**
   - Click your **backend service** (the one with your repo name, e.g. `arm-services-marketplace`)
   - Open the **Variables** tab
   - Click **+ New Variable** or **Add variable** or **Connect**
   - If you see **Add Reference** / **Reference another variable**: choose the **PostgreSQL** service and select **DATABASE_URL** so the backend gets `DATABASE_URL` automatically
   - If you don’t see that: open the **PostgreSQL** service → **Variables** tab → copy the value of **DATABASE_URL**, then in the **backend** service → **Variables** → **+ New Variable** → Name: `DATABASE_URL`, Value: (paste the URL) → Save

---

## Step 4: Set Build and Start commands

1. Click your **backend service** (the one from GitHub)
2. Open the **Settings** tab (or **Configure** → **Settings**)
3. Find **Build** section.

**Build Command – paste this exactly:**

```
pip install -r requirements.txt && python manage.py collectstatic --noinput
```

4. Find **Start** or **Start Command** (sometimes under **Deploy**).

**Start Command – paste this exactly:**

```
bash scripts/start.sh
```

5. Click **Save** or wait for auto-save. Railway will redeploy.

---

## Step 5: Generate a public URL for the backend

1. Stay in your **backend** service
2. Open **Settings** (or **Variables**)
3. Find **Networking** or **Public Networking** or **Generate Domain**
4. Click **Generate Domain** (or **Add domain**)
5. Railway will show a URL like:  
   `https://arm-services-marketplace-production-xxxx.up.railway.app`
6. **Copy the full URL** (you need it in the next step and for the frontend)
7. From that URL, copy **only the host part** (no `https://`, no path).  
   Example: if URL is `https://arm-services-marketplace-production-xxxx.up.railway.app`  
   → host = **`arm-services-marketplace-production-xxxx.up.railway.app`**  
   Use this exact value for **ALLOWED_HOSTS** below.

---

## Step 6: Add environment variables (backend)

1. In the **backend** service, open the **Variables** tab
2. Click **+ New Variable** (or **Add variable** / **Bulk add**)
3. Add the variables below **one by one** (Name = left, Value = right).  
   Replace the placeholders with your own values from the checklist at the top.

---

**Variable 1**

- **Name:** paste exactly  
  `SECRET_KEY`
- **Value:** paste the long key you generated (checklist #1)

---

**Variable 2**

- **Name:** paste exactly  
  `DEBUG`
- **Value:** paste exactly  
  `0`

---

**Variable 3**

- **Name:** paste exactly  
  `ALLOWED_HOSTS`
- **Value:** paste **only the host** from Step 5 (e.g. `arm-services-marketplace-production-xxxx.up.railway.app`)  
  No `https://`, no path.

---

**Variable 4**

- **Name:** paste exactly  
  `CORS_ALLOWED_ORIGINS`
- **Value:** your frontend URL, no trailing slash (checklist #2), e.g.  
  `https://arm-marketplace.vercel.app`

---

**Variable 5 (admin – recommended)**

- **Name:** paste exactly  
  `DJANGO_SUPERUSER_EMAIL`
- **Value:** your admin email (checklist #3), e.g.  
  `admin@example.com`

---

**Variable 6 (admin)**

- **Name:** paste exactly  
  `DJANGO_SUPERUSER_PASSWORD`
- **Value:** your admin password (checklist #4)

---

**Variable 7 (admin)**

- **Name:** paste exactly  
  `DJANGO_SUPERUSER_FULL_NAME`
- **Value:** display name (checklist #5), e.g.  
  `Admin`

---

4. Save. Railway will redeploy with these variables.

---

## Step 7: Check that the backend is running

1. Wait until the latest deploy shows **Success** / **Active**
2. Open in your browser (use **the full URL** from Step 5 + `/admin/`):  
   **https://YOUR-RAILWAY-HOST/admin/**  
   Example: `https://arm-services-marketplace-production-xxxx.up.railway.app/admin/`
3. Log in with:
   - **Email:** the value of `DJANGO_SUPERUSER_EMAIL`
   - **Password:** the value of `DJANGO_SUPERUSER_PASSWORD`
4. If you see the Django admin, the backend is deployed and the database works.

---

# Part 2: Connect the frontend to the backend

---

## Step 8: Set the API URL in Vercel (frontend)

1. Go to **https://vercel.com** and open your **frontend project** (the one with root = `frontend`)
2. Click **Settings** → **Environment Variables**
3. Click **Add New** (or edit existing)
4. **Name** – paste exactly:  
   `NEXT_PUBLIC_API_BASE_URL`
5. **Value** – paste your **full** Railway backend URL (from Step 5), **with** `https://`, **no** trailing slash.  
   Example:  
   `https://arm-services-marketplace-production-xxxx.up.railway.app`
6. Select **Production** (and **Preview** if you want)
7. Click **Save**
8. **Redeploy** the frontend: go to **Deployments** → click **⋯** on the latest deployment → **Redeploy**  
   (so the new env var is used)

---

## Step 9: Test the connection

1. Open your **frontend** in the browser (your Vercel URL)
2. Log in or open a page that uses the API (e.g. jobs list)
3. Open DevTools (F12) → **Console**. If there are no CORS errors and data loads, the frontend is connected to the Railway backend.

---

# Paste-ready summary

**Railway – Build Command (Step 4):**

```
pip install -r requirements.txt && python manage.py collectstatic --noinput
```

**Railway – Start Command (Step 4):**

```
bash scripts/start.sh
```

**Railway – Variables (Step 6):**  
Add each of these; replace the `...` with your values.

| Name | Value (replace ... with yours) |
|------|---------------------------------|
| `SECRET_KEY` | (output of the python command from checklist) |
| `DEBUG` | `0` |
| `ALLOWED_HOSTS` | `your-backend-host.up.railway.app` |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
| `DJANGO_SUPERUSER_EMAIL` | `admin@example.com` |
| `DJANGO_SUPERUSER_PASSWORD` | your password |
| `DJANGO_SUPERUSER_FULL_NAME` | `Admin` |

**Vercel – Environment Variable (Step 8):**

| Name | Value (replace with your Railway URL) |
|------|--------------------------------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://your-backend-host.up.railway.app` |

---

# Troubleshooting

- **400 on /admin/ or favicon.ico:** Django is rejecting the request because the host is not in `ALLOWED_HOSTS`. In Railway → **web** service → **Variables**, set **ALLOWED_HOSTS** to **only** your Railway host, e.g. `web-production-f698.up.railway.app` (no `https://`, no path, no spaces). Save and wait for redeploy, then try again.
- **Deploy fails / 502:** In Railway → backend service → **Deployments** → open the latest deploy → check **Logs**. Ensure Build and Start commands are pasted exactly (no extra spaces).
- **Invalid HTTP_HOST / 400:** `ALLOWED_HOSTS` must be **exactly** the host from your Railway URL (e.g. `something.up.railway.app`), no `https://`.
- **CORS error in browser:** Set `CORS_ALLOWED_ORIGINS` on Railway to your **exact** frontend URL (e.g. `https://your-app.vercel.app`), then redeploy the backend.
- **Frontend still calls old URL:** Redeploy the frontend after setting `NEXT_PUBLIC_API_BASE_URL`; test in incognito or clear cache.
- **Admin panel unstyled (no CSS):** The app uses `STATIC_URL = "/static/"` so admin CSS loads from the site root. If you still see broken styling, confirm the build command runs `python manage.py collectstatic --noinput` and redeploy.
