# CampusSphere deployment guide

CampusSphere is prepared for a Vercel frontend, a Render FastAPI service, and the existing Neon PostgreSQL database. No live service is deployed by this guide. The backend does not create or migrate the production schema at startup.

## Before pushing to GitHub

1. Confirm `.env`, `backend/.env`, local environment files, virtual environments, `node_modules`, `dist`, SQLite databases, and `.vercel` are ignored. The checked-in `.env.example` files contain placeholders only.
2. Review the staged file list before every commit. From PowerShell:

   ```powershell
   git status --short
   git check-ignore -v backend/.env backend/venv backend/campussphere_demo.sqlite3
   git diff --cached --name-only
   ```

3. Stage only project source, tests, migrations, and deployment documentation. Do not stage `.env`, database files/backups, credentials, generated build output, or local virtual environments. If a secret was ever committed, remove it from Git history and rotate it.
4. Commit and push to a private or public GitHub repository according to your project access needs. Connect that repository to Render and Vercel; do not upload local environment files.

## Neon database

Use the existing Neon project and database. In Neon, copy the PostgreSQL connection string from **Connect** and store it only in Render as `DATABASE_URL`. Use a TLS connection (`sslmode=require`); do not put it in a `VITE_*` variable or commit it. The application requires PostgreSQL in production and rejects SQLite. It does not fall back to the local demo fixture.

The repository's deployment preparation recorded a read-only schema review of the configured Neon database and the already-applied additive password-reset-token schema change. Startup does not run `create_all`, seed data, or apply migrations. Before a future schema change, review the migration SQL, verify it against a backup/recovery plan, apply it manually to the intended Neon branch, and confirm the resulting schema. Never run demo setup, seed, reset, or provisioning scripts against production. The repository's legacy seed/provisioning CLIs now refuse to apply changes to Neon even when confirmation flags are supplied; use only the isolated SQLite demo tools for generated demo records.

## Create the Render backend

1. In Render, create a Blueprint from the GitHub repository and select the repository's `render.yaml`, or create a Web Service manually using the settings below. The blueprint selects Render's free plan to honor the cost preference. Render says its [free services are for preview/hobby use, not production applications](https://render.com/docs/free); free services sleep after 15 minutes idle and can cold-start around a minute later. Upgrade the service before relying on it for campus operations.
2. The backend root is `backend/`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `python run_neon_backend.py`
5. Health check path: `/health`
6. Add these variables in the Render service's **Environment** page:

   | Name | Value |
   | --- | --- |
   | `CAMPUSSPHERE_ENV` | `production` |
   | `DATABASE_URL` | Existing Neon PostgreSQL connection string, kept private |
   | `JWT_SECRET_KEY` | Random secret of at least 32 characters; Render can generate it |
   | `CORS_ORIGINS` | Exact Vercel origin(s), comma separated, with no path |

   Render supplies `PORT`; the launcher binds to `0.0.0.0` and uses that port. If `PORT` is absent during a local production-configured run, it uses 8001. Production CORS accepts only the configured origins; development mode retains localhost origins.

7. Deploy and inspect the Render logs for a successful start. Visit `https://YOUR-RENDER-SERVICE.onrender.com/health`. A healthy response reports `environment` as `production`, `database` as `connected`, and `demo_mode` as `false`. The endpoint does not return connection details.

## Deploy the Vite frontend to Vercel

1. Import the same GitHub repository into Vercel. Set the project root to the repository root, framework preset to Vite, install command to `npm ci`, and build command to `npm run build`. The output directory is `dist`. Vercel's [free Hobby plan is limited to personal, non-commercial use](https://vercel.com/docs/plans/hobby); choose an eligible plan if CampusSphere is deployed for an institution or operational use.
2. Add this Vercel environment variable for Production (and Preview only if you intend to allow preview deployments to use the API):

   | Name | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | `https://YOUR-RENDER-SERVICE.onrender.com` |

   It is a public API origin, not a secret. Never configure the Neon URL or JWT key in Vercel.
3. Deploy. `vercel.json` rewrites client-side routes to `index.html` for React Router.
4. Copy the deployed Vercel origin, such as `https://your-project.vercel.app` (no trailing slash or path), into Render's `CORS_ORIGINS`. Add a second exact HTTPS origin only when needed. Redeploy the backend after changing the variable.
5. If using a Vercel preview URL, add that exact preview origin to `CORS_ORIGINS` only when previews should reach this backend. Redeploy Render after changing CORS.

## Environment variable reference

The root `.env.example` documents the frontend's public `VITE_API_BASE_URL`. `backend/.env.example` documents backend-only names with safe placeholders. For production, configure values in the hosting providers rather than copying these examples to a deployed service.

| Variable | Service | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Vercel | Public HTTPS base origin for all frontend API requests |
| `CAMPUSSPHERE_ENV` | Render | Must be `production`; selects PostgreSQL-only configuration |
| `DATABASE_URL` | Render | Existing Neon PostgreSQL connection string |
| `JWT_SECRET_KEY` | Render | Long random key for signing access tokens; never expose to frontend |
| `CORS_ORIGINS` | Render | Exact allowed HTTPS Vercel origin(s), comma separated |
| `PORT` | Render | Supplied by Render and consumed by the backend launcher |

## Post-deployment verification

1. Confirm `/health` reports a connected database and production environment. This verifies connectivity; it does not test user passwords.
2. Open the Vercel site directly at `/login`, then reload a nested route to confirm the SPA rewrite works.
3. Sign in with an existing student account and an existing admin account through the normal login form. Confirm the correct role-specific landing pages load. Do not include credentials in screenshots, logs, or support tickets.
4. Confirm the student can see the intended student pages and cannot access admin-only actions. Confirm the admin can load Analytics, Buildings, Occupancy, Energy, Notices, Alerts, Maintenance, and Bookings. Backend role checks remain authoritative.
5. Review notices, alerts, room availability, and booking history with existing records. Avoid creating, approving, cancelling, or deleting real bookings or publishing/removing production notices and alerts just to test deployment. Use an approved test account and test records if write-path checks are required.
6. In browser developer tools, confirm API calls go to the Render origin and have no CORS errors. Confirm production frontend assets contain no local API origin and no backend secrets.
7. Test authentication, booking writes, maintenance updates, notice/alert writes, and password reset only with a planned test workflow. Production password-reset endpoints are disabled; the demo reset workflow is restricted to local SQLite.

## Troubleshooting

- **Render build cannot import a package:** check `backend/requirements.txt` and the Render build log; redeploy after correcting and committing the dependency list.
- **Render starts but health returns 503:** verify `DATABASE_URL` is the existing Neon URL, TLS is required, the Neon branch is awake/reachable, and Render has the right secret. The health response intentionally hides connection details; use provider logs for diagnosis without printing credentials.
- **Render exits because of database configuration:** confirm `CAMPUSSPHERE_ENV=production` and that `DATABASE_URL` uses PostgreSQL. Production intentionally refuses SQLite.
- **Browser reports CORS:** set `CORS_ORIGINS` to the exact browser origin including scheme and hostname, without a path. Include the Vercel preview hostname only if needed, then redeploy Render.
- **Frontend reports `VITE_API_BASE_URL` missing:** set it in Vercel for the relevant deployment environment and rebuild/redeploy the frontend.
- **Nested page returns 404 on refresh:** confirm Vercel is using the root project directory and that `vercel.json` is included in the deployment.
- **Login returns invalid credentials:** verify the frontend targets the deployed Render service and that Render targets the existing Neon database. Do not reset accounts or change password hashes to troubleshoot a wrong database target.
- **Login returns a server configuration error:** check that `JWT_SECRET_KEY` is configured in Render and at least 32 characters. Rotating it invalidates existing access tokens but does not change account passwords.
- **Service feels slow on the first request:** free hosting plans may sleep or cold-start. Confirm current provider plan behavior before relying on a free tier for time-sensitive use.

## Current local workflow

The isolated demo continues to use `backend/run_demo_backend.py` and its marked SQLite fixture. For the Neon production-configured local backend, use `backend/run_neon_backend.py`; it selects production mode and PostgreSQL. Neither local command deploys the app. Production deployment must use the Render environment values and must not run seed or reset scripts.
