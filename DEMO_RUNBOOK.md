# CampusSphere Demo Runbook

> For the populated, isolated local SQLite demo dataset, follow [backend/LOCAL_DEMO_DATA.md](backend/LOCAL_DEMO_DATA.md). The local demo launcher accepts the optional `CAMPUSSPHERE_DEMO_PORT` variable (default `8000`); set it to `8001` for a second local port and set frontend `VITE_API_BASE_URL` to `http://127.0.0.1:8001` in the frontend terminal. These settings do not change the normal backend configuration. This runbook's in-memory backend instructions remain an empty smoke-test path; its separately gated Neon section is not required for the local demo.

## Scope and prerequisites

This runbook starts the app against an isolated, in-memory SQLite database. That database is empty, exists only for the backend process lifetime, and is not automatically given a schema or demo account. The application does not create tables on startup. As a result, this setup verifies backend startup and health, but it does **not** provide working login or populated, authenticated workflows.

Prerequisites already present in this worktree:

- Windows PowerShell
- Node.js and npm, with the project dependencies in `node_modules`
- The project Python environment at `backend/venv`
- Python dependencies installed in that environment

## Isolated Neon demo setup (gated)

No Neon project or branch has been verified for this worktree. Do not run the Neon commands below until the exact non-secret target details have been supplied and a separate approval to connect has been given. Database initialization and seeding require a further approval for writes after the read-only preflight passes.

Before requesting approval, verify in Neon Console that:

- This is a newly created, independent demo project, not a branch, fork, restore, or import from the existing team project.
- The project ID and default branch ID match the target you intend to use.
- The connection hostname is the direct, unpooled hostname. The guarded scripts reject hostnames containing `pooler`.
- The database name is the one shown for this independent project.
- The `public` schema contains no application objects or data and the selected role can connect, use the schema, and create tables. The scripts check schema objects and required privileges; the operator must verify project provenance and the empty starting target in Console.

You may share the project ID, branch ID, direct hostname, database name, and your Console verification with the assistant. Do not share a password, `DATABASE_URL`, credential export, or screenshot containing credentials. The project and branch ID command-line values are operator claims; PostgreSQL cannot independently prove them.

After approval to connect, open PowerShell at the repository root and set an explicit process-level URL using a credential prompt. Use the direct hostname and database copied from Console. Do not paste a URL from `.env`.

```powershell
$demoProjectId = Read-Host 'Verified independent demo project ID'
$demoBranchId = Read-Host 'Verified default branch ID'
$demoHost = Read-Host 'Verified direct, unpooled hostname'
$demoDatabase = Read-Host 'Verified database name'
$demoCredential = Get-Credential -Message 'Credentials for the isolated demo database'
$demoUser = [Uri]::EscapeDataString($demoCredential.UserName)
$demoSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($demoCredential.Password)
try {
  $demoPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($demoSecretPointer)
  $demoEncodedPassword = [Uri]::EscapeDataString($demoPassword)
  $env:DATABASE_URL = "postgresql+psycopg://${demoUser}:${demoEncodedPassword}@${demoHost}/${demoDatabase}?sslmode=require"
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($demoSecretPointer)
  Remove-Variable demoPassword, demoEncodedPassword, demoSecretPointer
  $demoCredential = $null
}
```

The password is entered in the secure prompt and is not written by these commands. The URL is available to child processes in this PowerShell session. Do not print it, enable shell tracing, or copy it into chat. The guarded scripts reject a missing process-level `DATABASE_URL` before importing `backend/database.py`, so they do not fall back to `.env`.

After connection approval, run only the read-only preflight:

```powershell
& .\backend\venv\Scripts\python.exe .\backend\preflight_demo_db.py `
  --expected-project-id $demoProjectId `
  --expected-branch-id $demoBranchId `
  --expected-host $demoHost `
  --expected-database $demoDatabase `
  --confirm-neon-target-verified
```

This connects to the target but issues only a read-only schema/identity/privilege check. It stops if the active database or schema is unexpected, the public schema is not empty, another non-system schema exists, or required privileges are absent. A successful result is not authorization to write. Review the target and preflight result, then obtain separate explicit approval before running either write command.

Only after that write approval, the exact same target is verified, and the read-only preflight passes, the guarded write commands are:

```powershell
& .\backend\venv\Scripts\python.exe .\backend\initialize_demo_db.py `
  --expected-project-id $demoProjectId `
  --expected-branch-id $demoBranchId `
  --expected-host $demoHost `
  --expected-database $demoDatabase `
  --confirm-neon-target-verified `
  --confirm-demo-write

& .\backend\venv\Scripts\python.exe .\backend\seed_demo.py `
  --expected-project-id $demoProjectId `
  --expected-branch-id $demoBranchId `
  --expected-host $demoHost `
  --expected-database $demoDatabase `
  --confirm-neon-target-verified `
  --confirm-demo-write
```

The initializer creates only the current ORM model tables in an empty schema; it does not migrate or repair a schema. The seeder uses fictional `DEMO` records, an explicitly simulated occupancy/energy source, and interactively requested admin/student passwords. It is transactional and does not replace existing matching records or password hashes. If a guard refuses or a command fails, stop; do not reset, drop, truncate, or weaken the checks. Clear the process URL when finished with `Remove-Item Env:\DATABASE_URL`.

Do not copy a database URL from a local `.env` file into these commands. Set the explicit SQLite override before starting Python; `backend/database.py` requires `DATABASE_URL` and `load_dotenv()` does not replace an existing process environment value.

## Start the backend safely

From the repository root, run:

```powershell
$env:DATABASE_URL = 'sqlite:///:memory:'
$secretBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($secretBytes)
$env:JWT_SECRET_KEY = [Convert]::ToBase64String($secretBytes)
Remove-Variable secretBytes
& .\backend\venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
```

The generated signing key stays in this PowerShell process and is not printed. It is temporary and changes when regenerated; tokens from a previous run will not remain valid. Keep this terminal open while using the API. No migrations, schema creation, seeding, or account creation are performed by these commands.

## Start the frontend

Open a second PowerShell terminal at the repository root:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Open the Vite URL shown in that terminal (normally `http://127.0.0.1:5173`). The frontend uses `http://127.0.0.1:8000` as its default API URL.

If port 8000 is occupied, stop only a process you recognize and own, or run the backend on another local port, such as 18765. In the frontend terminal, set its API URL before starting Vite:

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:18765'
npm.cmd run dev -- --host 127.0.0.1
```

Vite reads this setting at startup. Restart Vite after changing it.

## Verify API startup

With the backend terminal still running, use a third terminal:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8000/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8000/openapi.json -UseBasicParsing
```

The confirmed safe smoke-check responses were HTTP 200 for all three endpoints. `/health` checks a simple SQLite connection; it does not prove that tables or data exist. OpenAPI documents routes; it does not prove their database operations work.

Unauthenticated protected reads should be denied:

```powershell
try { Invoke-WebRequest http://127.0.0.1:8000/auth/me -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
try { Invoke-WebRequest http://127.0.0.1:8000/bookings -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
```

The confirmed result for both was HTTP 401. Do not attempt to bypass authentication or invent credentials to make protected pages appear functional.

## What can be demonstrated

| Feature | Current demonstration status |
|---|---|
| Login page | The unauthenticated login UI can be opened. A successful login requires a real account in a populated database; the safe in-memory setup has neither. |
| Student and admin pages | Routes exist and require role-appropriate authenticated accounts. Their populated API workflows cannot be demonstrated using the empty in-memory database. |
| Admin user directory | The route is present, but no user-list/create API exists. The page reports this limitation instead of showing sample users or totals. |
| Campus maps and digital twin | Local CAD/map assets can be shown after reaching an authenticated route. They are static source drawings and annotations, not live telemetry or verified room inventory. |
| Building/room browsing, bookings, notices, alerts, occupancy, energy, analytics | API-backed routes and UI paths exist. A populated database and authenticated account are required to demonstrate successful reads or writes. Do not create records against an external database for a demo. |
| Predictions | Forecasting is explicitly unavailable; the page reports that no forecast is generated or evaluated. |
| Scenario Lab | A deterministic room-scope calculation uses fetched building and room records. It is not a performance model or prediction and needs populated records. |
| Events and settings | Some UI content/preferences are local demonstration behavior; they do not imply a connected campus events, notifications, or persistence service. |
| Maintenance and QR | Demonstration-only UI. Student submission is logged to the browser console and is not persisted; admin examples are local/sample data; QR handling does not create a backend report. |

The backend tests use synthetic users, fake sessions, or isolated test logic. They are not a populated, reusable demo fixture. No safe fixture/setup path for an authenticated, populated browser demo has been verified.

## Manual browser checks

Browser automation/control was unavailable during the audit, so no route has been visually inspected. When a browser is available, inspect the login page and any routes reachable with an authorized account at both viewport sizes:

Check at **1440 × 900**, **1280 × 800**, and **375 × 812**.

1. Set the viewport to **1280 × 800** and open the intended route directly.
2. Set the viewport to **375 × 812** and repeat.
3. Check browser console and network requests for runtime errors and failed API calls.
4. Check for horizontal scrolling, clipped text, overlapping controls, unreadable content, and visible keyboard focus.
5. Check labels and accessible names by tabbing through forms and controls.
6. Check navigation, browser Back, loading/error/empty states, and links.
7. Use only authorized accounts and isolated fixtures. Do not submit bookings, notices, alerts, or other writes to a real campus database.

If a safe populated account and fixture are unavailable, record authenticated pages as blocked; do not treat the login page or an API health response as proof those workflows work.

## Maintenance/QR integration dependency

The backend currently has a `MaintenanceRequest` ORM model, but no maintenance request schema or maintenance/QR API route. The existing student/admin maintenance pages do not persist requests. A persisted workflow needs a reviewed backend contract and route, authenticated reporter identity, canonical room/location resolution from the scanned code, validated report fields, server-managed status and timestamps, and API-backed create/list/review behavior. These are dependencies for a future integration, not current functionality.

## Troubleshooting

- **Port already in use:** Do not connect to an unknown process. Choose another local backend port and set `VITE_API_BASE_URL` to the same port before starting Vite.
- **Missing command or dependency:** Confirm Node/npm are on `PATH` and the project virtual environment exists. Use the existing `node_modules` and `backend/venv`; this runbook does not install packages.
- **Login fails:** The empty in-memory database has no users or tables. A generated JWT signing key does not create an account. Use only an explicitly approved, safe fixture/account setup if one is provided separately.
- **Empty data or API errors:** The in-memory database is empty, has no initialized schema, and disappears when the backend stops. Health success only confirms a connection. Do not point this demo process at the configured external database to work around missing fixtures.
- **Protected routes redirect or return 401:** Authentication is required. Do not invent or hard-code credentials.
