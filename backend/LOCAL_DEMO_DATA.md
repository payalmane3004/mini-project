# Local CampusSphere demo data

This workflow creates fictional records in the dedicated disposable file `backend/campussphere_demo.sqlite3`. It does not use the existing Neon initializer or seeder, does not read `.env`, and never changes the normal database configuration. The generator sets `PYTHON_DOTENV_DISABLED=1` and a process-local SQLite URL before importing `backend/database.py`, then verifies the actual SQLAlchemy engine driver and exact file path before it creates tables or opens a write transaction.

## Preview and generate

From the repository root in PowerShell:

```powershell
& .\backend\venv\Scripts\python.exe .\backend\generate_demo_data.py --preview
```

Preview is the default and inspects the exact local SQLite database in read-only mode. It reports the fixture marker, occupancy and energy counts, source labels, stored and proposed timestamp ranges, and additions by type. The current fixture has readings for 12 of its 40 rooms and 8 of its 10 buildings; the proposed fill adds 784 occupancy readings and 56 energy readings for the uncovered facilities, reaching 1,120 and 280 total readings. The schedule covers the same 28 six-hour timestamps already stored. All additions use `SIMULATED_DEMO`. The CLI does not create users, rooms, bookings, notices, requests, alerts, or other records. Only `--apply` writes, and only to an existing complete marked local fixture after you review the preview. Missing, unmarked, or structurally incomplete fixtures are refused.

After reviewing those exact counts and timestamps, apply only with:

```powershell
& .\backend\venv\Scripts\python.exe .\backend\generate_demo_data.py --apply
```

The readings generator does not initialize or repair a fixture. An absent, unmarked, or incomplete local database is refused; it never creates schema or facilities as a side effect. The normal application database is never used as a fallback.

## Start local development

From the repository root, start the backend with the standard command:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

In another terminal from the repository root, start the frontend:

```powershell
npm run dev
```

Open `http://localhost:5173`. Default development mode ignores `backend/.env`, selects only this fixture, and checks its marker before startup. The frontend uses backend port `8000`; an explicit `VITE_API_BASE_URL` remains available for deliberate alternate local configurations. Development creates a process-only JWT key automatically; restarting the backend requires signing in again.

Production/shared database configuration remains available with `CAMPUSSPHERE_ENV=production`; in that mode the backend uses the process `DATABASE_URL` or the existing `backend/.env` value. Never set production mode for the local demo.

Use these verified credentials only with the isolated local SQLite demo:

- Admin email: `admin@campussphere-demo.example.invalid`
  Password: `CampusSphere-Local-Demo-Admin-2026!`
- Student email: `student@campussphere-demo.example.invalid`
  Password: `CampusSphere-Local-Demo-Student-2026!`

Both logins were verified against this SQLite file using the existing password hashing and authentication path. Do not reuse these credentials anywhere else. There is no facilities/staff role in the current role model.

### Demo-only password reset

On the login page, choose **Forgot password?**, enter one of the documented demo account emails, then select **Request reset link**. Because this local demo does not send email, the page displays a reset link only for those two documented accounts. Links expire after 15 minutes, and issuing a new link invalidates earlier links. Password reset endpoints require development mode, the exact marked `campussphere_demo.sqlite3` fixture, and a loopback request; they return unavailable in production or for any other database. New passwords must have at least 12 characters and include at least three of lowercase, uppercase, number, and symbol. After resetting, sign in normally with the new password.

The `DEMO DATA` indicator appears in admin and student top bars only when the backend confirms the approved SQLite file and marker. The admin dashboard also explains that fixture values are fictional and historical, that no live sensor feed is connected, and that the normal team database is separate and unchanged.

## Fixture contents

All names and records are explicitly labeled fictional. Demo building codes use the `DEMO-` prefix and intentionally do not claim a match to CAD footprints. Demo buildings are excluded from the operational building total. The Digital Twin continues to use its existing CAD geometry and exact-code matching; no demo coordinates or mappings are created.

| Application table | Records |
| --- | ---: |
| `users` | 2 |
| `buildings` | 10 |
| `rooms` | 40 |
| `room_bookings` | 12 |
| `room_occupancy` | 336 |
| `energy_readings` | 224 |
| `notices` | 4 |
| `emergency_alerts` | 4 |
| `maintenance_requests` | 6 |
| `building_floor_labels` | 30 |

Occupancy samples are nonnegative and do not exceed their room capacities. Both occupancy and energy use the `SIMULATED_DEMO` source. Simulated readings are excluded from operational analytics and default Occupancy/Energy responses. Admin Dashboard, Analytics, Occupancy, and Energy provide explicit, clearly labelled preview options; the API identifies demo rows and keeps demo totals separate from operational counts.

Bookings use supported statuses (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), valid time ranges, and non-overlapping rooms. The local demo UI can submit a booking or maintenance request against a labelled DEMO room only when the backend verifies the exact approved SQLite path and fixture marker. The backend rejects these room IDs in every other database mode, prefixes newly created local-demo workflow content as fictional, and exposes `is_demo` classification in API responses. Operational dashboard counts exclude demo bookings, maintenance, rooms, and readings by default. Local workflow records are preserved by subsequent idempotent generator runs if their room and content are explicitly marked demo.

The fixture has four unpublished fictional notices. The student notice endpoint also filters any legacy published title beginning with `DEMO`. The fixture emergency alerts have explicit fictional DEMO titles/messages, appear only in the active local demo, and are excluded from student feeds outside it. There are no separate events or facility/equipment inventory models, and no facilities/staff authorization role; the demo therefore does not invent records for those unsupported modules. Predictions remain unavailable and no forecast is generated.

Student accounts have authenticated, read-only `/student/occupancy/history` and `/student/energy/readings` endpoints. They expose only records whose stored source is marked simulated. Admin operational endpoints remain admin-only and exclude simulated records by default. Student pages are available at `/student-occupancy` and `/student-energy`.

## Reset only the disposable demo database

Stop the demo backend first, then remove only its exact database file:

```powershell
Remove-Item -LiteralPath .\backend\campussphere_demo.sqlite3
```

The occupancy and energy reading generator does not recreate a removed fixture. Do not remove the local database as part of reading generation. The command operates only on an existing exact marked file and never touches `.env` or any other database.

## Safe offline checks

The generator defaults to preview; `--apply` must be explicit. Backend regression tests use mocks and temporary in-memory SQLite engines; they do not connect to an external database. A read-only count/marker/integrity inspection can be run with Python's `sqlite3` module using `mode=ro`; never use a database client configured from `.env` for this inspection.

## Manual browser review

Browser automation is not configured in this project. After generating the local fixture and starting both processes, sign in with the local admin account and inspect `/`, `/analytics`, `/buildings`, `/rooms`, `/occupancy`, `/energy`, `/booking`, `/notices`, `/emergency`, `/scenario-lab`, and `/predictions`. Also sign in as the local student and inspect `/student-dashboard`, `/student-buildings`, `/student-rooms`, `/student-booking`, `/student-events`, and `/student-emergency`.

Repeat at **1440×900**, **1280×800**, and **375×812**. Check the conditional `DEMO DATA` badge, fictional-data notice, navigation, date filters, source labels, empty/error states, horizontal overflow, visible keyboard focus, and browser console/network errors. Do not treat the offline tests or production build as visual browser verification.
