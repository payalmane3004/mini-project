# Backend handoff

## Current frontend

This is a React single-page application built with Vite. It currently provides:

- An administrator dashboard with summary cards, Campus Status, charts, and alerts. Operational counts come from stored data and exclude demo inventory/readings by default; an explicit local preview exposes separate fictional values. The Dashboard no longer contains the separate Campus Digital Twin preview card.
- A CAD-based Digital Twin at `/digital-twin`: interactive campus footprints, CAD labels, building selection, source-linked details, building explorer navigation, and facility search.
- A building directory at `/buildings`, source-aware floors/rooms at `/rooms`, and `/building-explorer/:buildingId` for campus footprint and available building plan exploration. `/main-building-interior` is a separate Main Building study.
- Occupancy, energy, maintenance, analytics, predictions, alerts, bookings, scenarios, emergency, users, and settings screens. Database-backed workflows use authenticated API routes where implemented; scenario and settings interactions remain local, and predictions are unavailable.
- Student pages under `/student-*` for dashboard, buildings, rooms, booking, maintenance, events, emergency, profile, and map. `/login` authenticates against the FastAPI user table; student/admin frontend route guards complement backend authorization.

Unknown routes redirect to `/login`. Admin pages use `AppLayout`; student pages use `StudentLayout`. The frontend stores the short-lived bearer token in `sessionStorage`, validates it with `/auth/me` when a session is restored, and clears it on 401 responses or logout. Backend authorization remains the security boundary.

## Frontend stack

From `package.json`: React 19 and React DOM, React Router 7, Vite 8 with the React plugin, Three.js with React Three Fiber and Drei for 3D, Recharts for charts, Framer Motion for animation, and Lucide React for icons. ESLint is configured. Scripts are `dev`, `build`, `lint`, and `preview`.

## Digital Twin components and data

- `src/pages/Admin/DigitalTwin.jsx` composes `CampusScene`, `BuildingDetailsPanel`, and `CampusFacilitySearch`. Selection is also reflected in the `building` URL query parameter.
- `src/pages/Admin/BuildingExplorer.jsx` renders an extruded campus footprint and links supported CAD drawings and interior floor views. `src/pages/Admin/MainBuildingInteriorPrototype.jsx` contains the separate Main Building interior study.
- `src/components/digital-twin/FloorPlanViewer.jsx` displays plan assets and source annotations; `SourceBuildingPlan.jsx` loads inspection JSON reports with a browser `fetch` from their static public paths.
- `src/data/wce-campus-footprints.json` stores footprint IDs, source layers, areas, polygon coordinate arrays, and optional holes. `wce-building-labels.json` maps footprint IDs to arrays of CAD label text. `wce-campus-labels.json` and `wce-campus-site-lines.json` contain additional extracted CAD labels and site linework.
- `src/data/buildingDrawings.js` maps selected building IDs to original drawing paths, processed previews, inspection report paths, evidence/limitations, and (where available) floor views. `cadAnnotationCatalog.js`, the `main-building-*-labels.json` files, and `main-building-facilities.json` hold extracted annotation/facility data. Main Building architecture and trace modules are JavaScript geometry data.
- `public/campus-maps/` contains original DWG/PDF/DXF source files and processed DXF, SVG, and JSON inspection/conversion artifacts. These are static assets served by Vite; they are not fetched from an API.
- Facility search (`CampusFacilitySearch`) uses the local Main Building facilities JSON. It is source-backed CAD annotation/facility information, not a verified inventory of operational equipment or room assignments.

## Data status and limitations

Campus map geometry, labels, site lines, drawing previews, and inspection reports are static local source-derived files. The 3D building extrusion height and some architectural traces/zones are illustrative; the UI identifies uncertainty in source-plan and floor views. CAD annotations do not establish verified room boundaries, room IDs, floor assignments, or facility/equipment associations unless specifically stated as verified in the source data.

Dashboard, Analytics, Occupancy, and Energy query stored data. Demo rooms/floors/buildings/readings are marked and excluded from operational metrics by default; local admin pages have explicit preview controls. Occupancy and energy use the `SIMULATED_DEMO` source. The UI identifies demo readings as fictional historical values, not live telemetry. The separate CAD-based Digital Twin remains illustrative/source-derived and is not verified room inventory.

The FastAPI maintenance API supports authenticated student create/list/read-own operations and admin list/status updates. Booking and maintenance requests for demo rooms are allowed only when the backend verifies the exact marked local SQLite fixture; these local workflow records are explicitly labelled fictional. Every other database mode rejects demo-room workflows. Demo rooms are not editable through room management or eligible for QR-based real-room maintenance selection. Student notice endpoints exclude demo titles even when an older notice was published. Demo emergency alerts are explicitly classified and hidden from student feeds outside the marked local demo. Student/admin frontend route guards complement, but do not replace, backend authorization.

## Backend authentication

- `POST /auth/login` accepts JSON email/password and verifies PBKDF2-SHA256 password hashes. `GET /auth/me` validates the bearer token against the current user row and role.
- Tokens use HMAC-SHA256 and expire after 30 minutes. Normal backend runs read the signing key from `backend/.env` as `JWT_SECRET_KEY`; that file is Git-ignored. The local demo launcher disables dotenv and uses a temporary in-process key, so users must log in again after each restart. Do not copy any signing key into frontend configuration.
- `/analytics/summary`, `/occupancy`, and `/energy/readings` require the admin role. `include_demo=true` is an explicit preview for operational analytics and occupancy; Energy has its own explicit preview query. Operational totals remain separate and exclude demo records. Building, floor-label, and room directory reads accept admin and student roles. Maintenance creation is student-only; maintenance list/read is admin/student with students limited to their own requests; maintenance status updates are admin-only. Booking creation is student-only, while booking review is admin-only. Demo-room booking/maintenance calls require the marked local SQLite fixture; normal database deployments continue to reject them. `/`, `/health`, and login are public.
- No migration or public registration endpoint is included. The local demo fixture has fictional `admin` and `student` accounts only; verified local-only login details are in [backend/LOCAL_DEMO_DATA.md](backend/LOCAL_DEMO_DATA.md). The demo backend launcher disables dotenv loading, selects only `backend/campussphere_demo.sqlite3`, and creates a temporary signing key. Never reuse the local demo accounts against another database.

The separate user provisioning utility is not part of local demo setup. Do not run external-database provisioning or seeding for the local demo. If used in another approved context, `provision_user.py` requires independent target confirmation and process-level configuration.

  ```powershell
  & .\venv\Scripts\python.exe .\provision_user.py `
    --expected-project-id $projectId `
    --expected-branch-id $branchId `
    --expected-host $host `
    --expected-database $database `
    --confirm-neon-target-verified `
    --confirm-user-write
  ```

  Provisioning hashes the prompted password and does not run on application startup.
- This is project-level authentication, not a full identity service: login throttling, account recovery, MFA, and centralized key rotation are not implemented. Browser session storage is readable by same-origin JavaScript; preventing XSS remains necessary.

## Suggested API integration points

The API already provides authenticated login, directories, bookings, notices, alerts, maintenance requests, occupancy, energy, and analytics. The following table describes additional integration/design work, not endpoints currently guaranteed by the service.

| Area | Frontend integration point | Suggested backend capability |
| --- | --- | --- |
| Buildings and map | `DigitalTwin.jsx`, `CampusScene.jsx`, `Buildings.jsx`, `BuildingExplorer.jsx`; currently imports local footprint and label JSON | List/search buildings and return stable IDs, names/aliases, CAD labels, footprint geometry, source/provenance and confidence. Decide whether geometry is API data or versioned static assets. |
| Floors and plans | `BuildingExplorer.jsx`, `BuildingDetailsPanel.jsx`, `FloorPlanViewer.jsx`, `SourceBuildingPlan.jsx`, `MainBuildingInteriorPrototype.jsx` | Return verified floor/plan metadata and plan asset/report references. Keep source annotation distinct from verified room entities and preserve provenance and uncertainty. |
| Facilities | `CampusFacilitySearch.jsx`, `main-building-facilities.json` | Search facilities with building/floor/room linkage only where verified; decide whether to expose CAD-derived candidates separately from operational records. |
| Occupancy | `Occupancy.jsx`, `OccupancyChart.jsx`, `StatsGrid.jsx`, `CampusStatus.jsx` | Provide timestamped occupancy readings and aggregation by building/campus, with units, source, freshness, and missing/stale states. |
| Energy | `Energy.jsx`, dashboard summary/chart components | Provide timestamped energy readings and aggregations with units, meter/building mapping, source, and freshness. |
| Maintenance | `Maintenance.jsx`, `StudentMaintenance.jsx`, `WorkspacePage.jsx`, `CampusQrScanner.jsx` | Authenticated request creation, own-request reads, and admin status updates are connected to the API; QR scanning resolves an existing non-demo room before opening the request form. Assignment, status history, and external QR target registration are not implemented. |

Prefer a shared API client/data layer and loading/error/empty states over adding network calls independently to page components. Agree on identifiers, units, timestamps, pagination/search behavior, provenance, authorization, and error semantics before binding these screens.

## Verify before implementation

- Confirm the authoritative building list, stable IDs, names/aliases, footprint coordinate reference/units, and whether the supplied CAD geometry may be served as-is.
- Review drawing associations and the inspection/architecture notes in `docs/cad-inspection/`. The selected plans are evidence-linked, but several associations and floor groupings are explicitly limited or unverified.
- Confirm what counts as a room versus a CAD text label, and which facility entries are operational records rather than extracted annotations.
- Identify authoritative occupancy, energy, alerts, and maintenance sources, their units, update frequency, retention, and permitted aggregation. Current sample values must not be treated as seeded production data.
- Before deployment, configure TLS, rate limiting, account recovery, and JWT key rotation; client-side route guards and browser token storage are not security boundaries.
- Decide API deployment/base URL, CORS, data ownership, and whether public floor-plan/CAD assets remain static. No endpoint names or database tables are assumed here.

## Handoff/build notes

For the populated local demo, follow [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md) and [backend/LOCAL_DEMO_DATA.md](backend/LOCAL_DEMO_DATA.md). The ordinary backend configuration is separate; do not set it to the local demo file or copy configuration into frontend code. The repository `.gitignore` excludes dependencies, build output, logs, and common editor files; it has no rule excluding `src/data`, `docs`, `scripts`, or `public/campus-maps`. CAD/source assets currently visible in `git status` as untracked still need to be included in whatever commit or transfer carries this work; untracked does not mean ignored.
