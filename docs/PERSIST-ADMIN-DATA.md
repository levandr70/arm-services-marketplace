# Step-by-step: Keep admin data (stop it disappearing after deploy)

Your admin user disappeared because the app was using **SQLite** on Render, and Render’s disk is **ephemeral**—it’s cleared on each deploy or restart. Follow these steps to switch to **PostgreSQL** so data (including admin users) persists.

---

## Step 1: Create a PostgreSQL database on Render

1. Go to [Render Dashboard](https://dashboard.render.com) and log in.
2. Click **New +** → **PostgreSQL**.
3. Configure:
   - **Name:** e.g. `arm-marketplace-db`
   - **Region:** Same as your backend Web Service (e.g. Oregon).
   - **PostgreSQL version:** 15 or 16 (default is fine).
   - **Plan:** Free (for testing).
4. Click **Create Database**.
5. Wait until the status is **Available**.

---

## Step 2: Get the database connection details

1. Open your new PostgreSQL service (click its name).
2. In the **Connections** section, find **Internal Database URL** (use Internal so the backend and DB are on the same network).
3. It looks like:
   ```text
   postgres://USER:PASSWORD@HOST:PORT/DATABASE
   ```
4. From that URL, note:
   - **DB_NAME** = database name (last part after the final `/`)
   - **DB_USER** = user (first part before `:`)
   - **DB_PASSWORD** = password (between `://` and `@`)
   - **DB_HOST** = host (after `@`, before `:`)
   - **DB_PORT** = port (number after the host, before `/`)

   Example:  
   `postgres://arm_user:abc123@dpg-xxx.oregon-postgres.render.com:5432/arm_marketplace`  
   → `DB_NAME=arm_marketplace`, `DB_USER=arm_user`, `DB_PASSWORD=abc123`, `DB_HOST=dpg-xxx.oregon-postgres.render.com`, `DB_PORT=5432`

---

## Step 3: Add the database env vars to your Web Service

1. In Render, go to **Dashboard** → your **Web Service** (the Django backend, e.g. `arm-marketplace-api`).
2. Open **Environment** (left sidebar).
3. Click **Add Environment Variable** and add these **one by one** (use the values from Step 2):

   | Key         | Value (your actual values from Step 2) |
   |------------|----------------------------------------|
   | `DB_NAME`   | e.g. `arm_marketplace`                 |
   | `DB_USER`  | e.g. `arm_user`                       |
   | `DB_PASSWORD` | e.g. `abc123` (the password from Internal URL) |
   | `DB_HOST`  | e.g. `dpg-xxx.oregon-postgres.render.com` |
   | `DB_PORT`  | `5432`                                |

4. **Save Changes.** Render will redeploy your backend.

---

## Step 4: Set the superuser env vars (so an admin is created automatically)

1. Still in **Environment** for your Web Service, add (or update) these so the start script can create an admin user:

   | Key                         | Value                    |
   |----------------------------|--------------------------|
   | `DJANGO_SUPERUSER_EMAIL`   | Your admin email (e.g. `admin@example.com`) |
   | `DJANGO_SUPERUSER_PASSWORD` | A strong password       |
   | `DJANGO_SUPERUSER_FULL_NAME` | Display name (e.g. `Admin`) |

2. **Save Changes** again. Render will redeploy.

After deploy, the start script will run migrations on the **PostgreSQL** database and create this superuser (or skip if it already exists). This admin will **persist** across restarts and deploys.

---

## Step 5: Confirm it works

1. Wait for the deploy to finish (green “Live” on the service).
2. Open your backend admin URL, e.g. `https://your-service.onrender.com/admin/`.
3. Log in with `DJANGO_SUPERUSER_EMAIL` and `DJANGO_SUPERUSER_PASSWORD`.
4. Add any extra admin users or data you need—they will now persist.

---

## Optional: Connect the database to the Web Service (Render UI)

If your Render plan supports it:

1. Web Service → **Environment** → **Add Environment Variable**.
2. Use **Add from Render** or **Link Database** and pick your PostgreSQL service.
3. Render may add a single `DATABASE_URL`. Your app expects separate `DB_*` vars, so either:
   - Keep using the five `DB_*` variables you added in Step 3, or  
   - Add a **Build/Start** step or a small script that sets `DB_NAME`, `DB_USER`, etc. from `DATABASE_URL`. For this project, the manual `DB_*` vars in Step 3 are enough.

---

## Summary

| Before (SQLite)              | After (PostgreSQL)                    |
|-----------------------------|--------------------------------------|
| Data lost on deploy/restart | Data persists                        |
| No `DB_NAME` set            | `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` set |
| Admin recreated only if env set, then lost again | Admin and all data persist in Postgres |

If something fails (e.g. “could not connect”), double-check:

- You used the **Internal** connection string (not External).
- All five `DB_*` variables are set and have no extra spaces.
- The Web Service and the PostgreSQL database are in the **same region**.
