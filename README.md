# CampusSphere: Smart Campus Digital Twin

CampusSphere is a React/Vite campus interface with a FastAPI backend for authenticated campus workflows and operational-data views. The interactive Digital Twin and building exploration use local CAD-derived assets; they are not live telemetry or a verified inventory.

## Safety and data status

- Occupancy and energy values are not live sensor readings. Demo readings use the `SIMULATED_DEMO` source and are excluded from operational summaries by default. Admin Energy, Occupancy, Dashboard, and Analytics have explicit, visibly labelled preview controls.
- Demo rooms, buildings, and floor labels are classified and labelled; demo inventory is excluded from operational totals. Demo rooms cannot be used for real workflows or changed through room management. Booking and maintenance requests for demo rooms are enabled only when the backend confirms the marked, dedicated local SQLite demo; those records are explicitly labelled fictional.
- Demo notices remain unpublished drafts and are filtered from student notice APIs even if an older demo notice was published. Fictional demo alerts are explicitly labelled and excluded from student feeds outside the isolated local demo.
- Do not use shared or production data for a demonstration. For an optional, isolated local fixture, follow [backend/LOCAL_DEMO_DATA.md](backend/LOCAL_DEMO_DATA.md); fixture generation creates fictional records in its dedicated SQLite file and is a separate, explicit operator action.

## Requirements and setup

The frontend uses Node.js/npm and the dependencies in `package.json`. The backend expects the preconfigured `backend/venv` Python environment. No backend `requirements.txt` or other Python dependency lockfile is currently included, so a fresh backend environment is not reproducible from this repository alone.

For ordinary local development, the backend defaults to the marked local SQLite fixture at `backend/campussphere_demo.sqlite3`. It does not load `backend/.env` in development mode. A non-SQLite/shared database requires `CAMPUSSPHERE_ENV=production`; production keeps the existing `DATABASE_URL` environment and `backend/.env` configuration path. The current verified local-only accounts are listed in [backend/LOCAL_DEMO_DATA.md](backend/LOCAL_DEMO_DATA.md). Never use them against a shared database.

Start the backend from the repository root using the standard command:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

In another terminal from the repository root, start the frontend:

```powershell
npm run dev
```

Open `http://localhost:5173`. Vite binds to localhost and uses a strict port; the development API client defaults to backend port `8000`, matching the standard Uvicorn command. An explicit `VITE_API_BASE_URL` still overrides that default. See [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md) for the demonstration sequence.

## Validation

Run frontend checks from the repository root:

```powershell
npm.cmd run lint
npm.cmd run build
```

Run the isolated backend tests from the repository root after setting a process-local SQLite URL and disabling dotenv loading:

```powershell
$env:PYTHON_DOTENV_DISABLED = '1'
$env:CAMPUSSPHERE_ENV = 'test'
$env:DATABASE_URL = 'sqlite:///:memory:'
Set-Location .\backend
& .\venv\Scripts\python.exe -m unittest test_authorization test_demo_db_setup test_local_demo test_maintenance test_password_reset test_provision_user test_resource_integrity test_room_creation test_seed_campussphere_dashboard_demo test_seed_campussphere_demo test_student_workflows test_database
```

These tests use mocks or isolated temporary databases. The database configuration tests never connect to the shared `.env` database; one confirms production dotenv selection by checking only the configured SQLAlchemy dialect. Do not execute `test_db.py`, which attempts a configured database connection.

Run the frontend regression tests with Node.js from the repository root:

```powershell
$testFiles = Get-ChildItem .\src -Recurse -File -Filter *.test.js | ForEach-Object { $_.FullName }
node --test
```

Check backend Python syntax without importing modules or opening a database connection:

```powershell
Set-Location .\backend
& .\venv\Scripts\python.exe -m compileall -q -x '(^|[\\/])venv([\\/]|$)' .
```

## Demonstration sequence

Use only the dedicated local fixture and its local accounts:

1. Sign in as admin and show the database-backed room directory, demo room/floor labels, and admin notice drafts.
2. Open Dashboard and Analytics with demo preview off to show operational totals, then opt in to the clearly labelled preview to show fictional demo counts and historical trends.
3. Open Energy and Occupancy; show that operational readings are excluded by default, then opt in to the visibly labelled simulated preview.
4. Sign in as student and show room browsing and the notice feed. From the dashboard, open **Report an Issue**, select a building and room, and review the title, description, and priority fields. Room booking uses authenticated room IDs and server-side conflict checks; the page reports that no live availability feed is connected. Only create a booking or maintenance request when an explicitly approved demonstration write is intended: the isolated local demo labels eligible DEMO rooms and marks resulting records fictional, and the same demo-room workflow requests are rejected outside that marked local database.
5. Show the explicitly labelled local demo alerts and existing booking/maintenance records. Keep demo notices unpublished.
6. Demonstrate the static CAD-based Digital Twin separately from verified operational records, and describe predictions as unavailable unless the UI reports otherwise.

See [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md) for startup/smoke-check details and [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md) for current integration boundaries and limitations.
