# Local CampusSphere demo data

This workflow creates fictional records in the dedicated disposable file `backend/campussphere_demo.sqlite3`. It does not use the existing Neon initializer or seeder, does not read `.env`, and never changes the normal database configuration. The generator sets `PYTHON_DOTENV_DISABLED=1` and a process-local SQLite URL before importing `backend/database.py`, then verifies the actual SQLAlchemy engine driver and exact file path before it creates tables or opens a write transaction.

## Preview and generate

From the repository root in PowerShell:

```powershell
& .\backend\venv\Scripts\python.exe .\backend\generate_demo_data.py --preview
& .\backend\venv\Scripts\python.exe .\backend\generate_demo_data.py
```

Preview lists planned table counts without opening a database. Before any schema or data writes, the script asks you to choose and confirm a local-only admin password and student password using hidden input. Use passwords that are not used anywhere else. The script stores only the existing application password hashes and does not print the passwords. A second run detects the fixture marker and reports current counts without prompting, inserting, or replacing records.

If an interrupted first attempt left exactly the ten application tables plus the empty fixture marker table, with zero rows, no extra tables, views, or triggers, the generator can safely resume that reserved local file after rechecking those conditions. Other unmarked schemas, any existing rows, extra tables, views, or triggers are refused. The normal application database is never used as a fallback.

## Start the demo backend and frontend

Start the backend from the repository root:

```powershell
& .\backend\venv\Scripts\python.exe .\backend\run_demo_backend.py
```

The launcher disables dotenv loading, targets only the exact demo file, confirms its marker, enables SQLite foreign-key checks, and binds to `127.0.0.1:8000` by default. To use another local port, set the demo-only `CAMPUSSPHERE_DEMO_PORT` variable in that PowerShell terminal before launching. For example, to use port `8001`:

```powershell
$env:CAMPUSSPHERE_DEMO_PORT = "8001"
& .\backend\venv\Scripts\python.exe .\backend\run_demo_backend.py
```

The launcher accepts only integer TCP ports from `1` through `65535`; an invalid value stops startup. This variable affects only the demo launcher and does not change the normal backend configuration. The launcher creates a fresh in-process JWT signing key on each start; existing browser sessions must log in again after a restart. It refuses to start if the isolated fixture is absent or incomplete.

In a second PowerShell terminal:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

When the demo backend uses port `8001`, configure the frontend in its own PowerShell terminal so its API requests go to that backend:

```powershell
$env:VITE_API_BASE_URL = "http://127.0.0.1:8001"
npm.cmd run dev -- --host 127.0.0.1
```

This frontend variable is process-local and does not alter the normal backend or database configuration.

Open the local Vite URL (normally `http://127.0.0.1:5173`). Use one of these local-only demo accounts and the password you chose at generation:

- Admin: `admin@campussphere-demo.example.invalid`
- Student: `student@campussphere-demo.example.invalid`

The `DEMO DATA` indicator appears in admin and student top bars only when the backend confirms the approved SQLite file and marker. The admin dashboard also explains that fixture values are fictional and historical, that no live sensor feed is connected, and that the normal team database is separate and unchanged.

## Fixture contents

All names and records are explicitly labeled fictional. Demo building codes use the `DEMO-` prefix and intentionally do not claim a match to CAD footprints. The Digital Twin continues to use its existing CAD geometry and exact-code matching; no demo coordinates or mappings are created.

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

Occupancy samples are nonnegative and do not exceed their room capacities. Occupancy uses the existing `RECORDED_VIDEO` source convention; energy uses `SIMULATED` and remains individual kWh readings. Bookings use the supported `PENDING`, `APPROVED`, `REJECTED`, and `CANCELLED` values, have valid time ranges, and use separate rooms to avoid active overlaps. The fixtures include two active unexpired alerts; expired and inactive alerts are excluded by the dashboard's active count.

The maintenance rows are clearly labeled fixtures for the analytics open-request count only. The existing maintenance/QR UI is not made persistent, and the existing app has no maintenance request API. Predictions remain unavailable and no forecast is generated.

## Reset only the disposable demo database

Stop the demo backend first, then remove only its exact database file:

```powershell
Remove-Item -LiteralPath .\backend\campussphere_demo.sqlite3
```

Run the generator again to create a fresh fixture and choose new local-only passwords. Do not use `Remove-Item` on a directory, wildcard, or any other database file. This reset does not affect `.env`, Neon, or another project database.

## Safe offline checks

The generator has a `--preview` mode. Backend regression tests use mocks and temporary in-memory SQLite engines; they do not run the demo generator, connect to Neon, or create the persistent demo file. The persistent database is created only when you explicitly run the generator above.

## Manual browser review

Browser automation is not configured in this project. After generating the local fixture and starting both processes, sign in with the local admin account and inspect `/`, `/analytics`, `/buildings`, `/rooms`, `/occupancy`, `/energy`, `/booking`, `/notices`, `/emergency`, `/scenario-lab`, and `/predictions`. Also sign in as the local student and inspect `/student-dashboard`, `/student-buildings`, `/student-rooms`, `/student-booking`, `/student-events`, and `/student-emergency`.

Repeat at **1440×900**, **1280×800**, and **375×812**. Check the conditional `DEMO DATA` badge, fictional-data notice, navigation, date filters, source labels, empty/error states, horizontal overflow, visible keyboard focus, and browser console/network errors. Do not treat the offline tests or production build as visual browser verification.
