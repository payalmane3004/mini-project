# CampusSphere college demo runbook

The college demonstration uses only the marked SQLite fixture at `backend\campussphere_demo.sqlite3`. The demo launcher forces development mode, disables dotenv loading, and validates the fixture marker and exact SQLite path. It never loads or connects to Neon.

## Start the demo

Ports 8000 and 8001 may be occupied by other CampusSphere services. Do not stop or reuse them. In a PowerShell terminal from the repository root, start the demo API on 8002:

```powershell
Set-Location .\backend
$env:CAMPUSSPHERE_DEMO_PORT = '8002'
& .\venv\Scripts\python.exe .\run_demo_backend.py
```

Confirm `http://127.0.0.1:8002/health` reports `environment: development`, `database: connected`, and `demo_mode: true`. Keep this terminal open. Backend restarts invalidate login sessions.

In a second PowerShell terminal from the repository root, start Vite on 5174 with the demo API explicitly selected:

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8002'
npm.cmd run dev -- --port 5174
```

Open `http://localhost:5174/login`. These existing accounts are for the local demo fixture only; do not use them on a deployed service.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@campussphere-demo.example.invalid` | `CampusSphere-Local-Demo-Admin-2026!` |
| Student | `student@campussphere-demo.example.invalid` | `CampusSphere-Local-Demo-Student-2026!` |

The admin credential was verified through `/auth/login`, `/auth/me`, and the authenticated Predictions API. Avoid resetting either account for the demonstration.

## Prediction sample history

The prediction seeder accepts only the existing marked SQLite fixture. It adds missing tagged readings and refreshes only its own `SIMULATED_PREDICTION_DEMO` samples; it never connects to Neon. Preview first, then apply if the preview shows rows to add or adjust:

```powershell
Set-Location .\backend
& .\venv\Scripts\python.exe .\seed_prediction_demo.py
& .\venv\Scripts\python.exe .\seed_prediction_demo.py --apply
```

The current fixture has 56 days of timestamped history and produces occupancy and energy estimates, peak periods, underutilized rooms, and recommendations. Repeat preview should report zero changes.

## Demonstration sequence

1. As admin, show the dashboard, then Buildings and Rooms. Explain that the campus facility data in this fixture is fictional demo data.
2. Open Analytics, Occupancy, and Energy. Point out their explicit simulated-data labels; readings are historical samples, not live telemetry.
3. Open Predictive Intelligence. Explain that the seven-day estimates use medians for matching weekday/hour slots in the prior 28 days. Show occupancy utilization, expected energy per recorded interval, peak periods, underutilized rooms, recommendations, and coverage indicators. State that these are simulated baselines, not a validated model.
4. Explain that production Neon currently has no operational timestamped occupancy or energy readings. Its Predictions page should show a missing-data state instead of invented forecasts.
5. Show Scenario Lab and the CAD-based Digital Twin as planning tools. Do not describe scenario output or CAD annotations as observed database readings.
6. If time permits, sign in as student and browse buildings/rooms, notices, emergency alerts, bookings, maintenance, and QR complaint flow. Any demonstration write must remain in the isolated SQLite fixture; do not submit demo data to Neon.

## Safe local checks

From the repository root:

```powershell
& .\backend\venv\Scripts\python.exe .\backend\generate_demo_data.py --preview
$env:PYTHON_DOTENV_DISABLED = '1'
$env:CAMPUSSPHERE_ENV = 'test'
$env:DATABASE_URL = 'sqlite:///:memory:'
Set-Location .\backend
& .\venv\Scripts\python.exe -m unittest discover
Set-Location ..
node --test
npm.cmd run lint
npm.cmd run build
```

These automated checks use fake sessions, in-memory databases, or temporary SQLite files. Do not run `test_db.py`; it attempts a configured database connection. Browser verification is separate and should only be reported if actually performed.

## Safety boundaries

- Keep the local demo backend on its dedicated launcher and the frontend pointed at `http://127.0.0.1:8002`.
- Do not run legacy Neon sample-data or demo-schema apply commands. They now refuse before opening a database connection.
- Production Neon records and operational data are separate from the local fixture. Simulated readings remain labelled and excluded from operational prediction results.
- Local demo bookings and maintenance flows are visibly simulated; never present them as real campus activity.
