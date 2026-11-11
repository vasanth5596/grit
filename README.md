# GRIT interview scheduling prototype

React + Tailwind frontend, FastAPI backend, and SQLAlchemy persistence. The app uses SQLite for local development and Supabase Postgres for a hosted database.

## Run locally

Requirements: Node.js 20+, Python 3.11+.

1. Install frontend packages: `npm install`
2. Create and activate a Python environment, then install `pip install -r requirements.txt`
3. If you do not already have a `.env`, copy `.env.example` (PowerShell: `if (!(Test-Path .env)) { Copy-Item .env.example .env }`), then start the API from the project root: `python -m uvicorn backend.app.main:app --reload`
4. In a second terminal, start React: `npm run dev`
5. Open `http://localhost:5173`. FastAPI docs are at `http://localhost:8000/docs`.

The demo API seeds five students and sample interview availability on first startup. Local data is kept in `grit_interviews.db`; deleting this local database resets the demo. Vite proxies `/api` requests to FastAPI. Keep `.env` and database files private; they are git-ignored.

## Deploy the backend to Render

1. Push the project to a GitHub repository. Do not commit `.env`, database files, `node_modules`, `.venv`, or `dist`.
2. Deploy the frontend to Vercel first (see below) without `VITE_API_BASE_URL` so you can get its production domain.
3. In Render, create a **Blueprint** from that repository and select `render.yaml`.
4. In Render's environment settings, set `DATABASE_URL` to the **Session pooler** connection string from Supabase (**Connect → Session pooler**). Use the exact host, port, username, and database from Supabase; do not use the direct `db.<project-ref>.supabase.co` host for Render's IPv4 network. Keep the password private and do not put it in Vercel.
5. Set `CORS_ORIGINS` to your Vercel production origin (for example, `https://your-project.vercel.app`, with no trailing slash). `SEED_DEMO_DATA=true` initializes demo rows on a new database; set it to `false` if you do not want demo records.
6. After deployment, verify `https://<your-render-service>.onrender.com/api/health`. The API creates its tables in Supabase on startup. The existing local `grit_interviews.db` data is not automatically copied; the remote database starts with demo data unless seeding is disabled.

The Render API can use its free plan, but free web services sleep when idle and their filesystem is temporary. The database is separate in Supabase, so API restarts do not erase it.

## Deploy the frontend to Vercel

1. Import the same GitHub repository into Vercel. Set the project root to `.` (the repository root), framework preset to **Vite**, build command to `npm run build`, and output directory to `dist`.
2. Make an initial deployment without `VITE_API_BASE_URL` to obtain the production domain for Render's `CORS_ORIGINS`.
3. After the Render API is deployed, add `VITE_API_BASE_URL` with the Render service origin, for example `https://your-render-service.onrender.com` (no trailing slash), and redeploy Vercel.

Vite's development proxy remains active when `VITE_API_BASE_URL` is unset. Vercel receives only the public API origin; database credentials stay in Render's backend environment variables.

## Supabase Free plan notes

Supabase Free currently includes 500 MB of database storage, but projects with low activity may be paused after 7 days. A paused project can be restored in the Supabase dashboard; it is not an always-on guarantee. Free projects also do not include downloadable database backups. Check Supabase's [current pricing](https://supabase.com/pricing) and [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) for up-to-date quotas and restrictions.

This assignment prototype uses a fixed demo student and interviewer identity and intentionally has no login or role-based authorization. It is suitable for a demo, not real student data, until authentication, authorization, and reviewed database migrations are added.

## Main API routes

- `GET /api/students/{student_id}/dashboard`
- `GET /api/slots?student_id=student`
- `POST /api/bookings` and `POST /api/bookings/{id}/cancel`
- `GET /api/interviewer/schedule?date=YYYY-MM-DD`
- `GET/POST /api/interviewer/availability`
- `POST /api/bookings/{id}/outcome`
- `GET /api/team/roster`
- `POST /api/admin/students` — add a student to the roster.
- `POST /api/admin/interviewers` — add an interviewer to the directory.
- `GET /api/admin/roster.csv` — download the student roster and latest interview details as a CSV attachment.
- `GET /api/admin/overview` — admin metrics, students, booking history, interviewer directory, and all interviewer availability.

The frontend includes the student booking flow, interviewer availability and outcome recording, eligible-student roster, and before/after result dashboard previews. Demo interactions persist through FastAPI and the configured database.
