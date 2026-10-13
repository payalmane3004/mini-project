# Campus building drawing inventory

Audited the files under `public/campus-maps/`, the footprint IDs in `wce-campus-footprints.json`, source text labels in `wce-building-labels.json`, `buildingDrawings.js`, and the existing CAD inspection reports. Source DWGs were not modified or reconverted.

## In-app architectural plan

| Campus ID | Source drawing | Available representation | Evidence |
|---|---|---|---|
| `BU-002` | `academic/main building.dwg` | Converted DXF, main plan SVG, and separate Ground/First Floor underlays; both floors are wired to the existing Main Building interior viewer. | Drawing title is Main Building and campus DXF text maps Main Building to BU-002. |

The conversion report records ODA File Converter 27.9.0 to ACAD2018 DXF. The underlays retain source linework and annotations. The existing assisted 3D trace is approximate and explicitly distinguishes reviewed traces, unverified candidates, and source labels. It does not claim verified room boundaries. See `main-building-room-identification-investigation.md` and `main-building-prototype-alignment.md`.

## Original DWGs confidently associated by name and campus label

These associations are useful for identifying a source file, but there is no converted plan representation for in-app rendering. The details panel links to the original DWG and the explorer keeps the campus footprint exterior with an explanation.

| Campus ID | Campus source label | Original DWG | Association evidence |
|---|---|---|---|
| `BU-001` | Tilak Hall / Quadrangle | `other/Tilak hall NAC.dwg` | Exact Tilak Hall name; the footprint also carries Quadrangle. |
| `BU-003` | Mechanical Deptt / Civil Deptt | `other/Mechanical Department.dwg` | Mechanical Department matches the Mechanical Deptt label; the footprint is shared with Civil Deptt. |
| `BU-007` | Electrical Deptt | `academic/Electrical Department.dwg` | Department name matches the Electrical Deptt label. |
| `BU-015` | Vartak Hall | `other/vartak hall.dwg` | Exact name match. |
| `BU-025` | D1 | `hostels/D1 Hostel.dwg` | Exact D1 identifier and hostel filename. |
| `BU-037` | Cyber Hostel | `hostels/Cyber Hostel.dwg` | Exact name match. |
| `BU-040` | Director Bunglow | `other/Director Bunglow.dwg` | Exact name match. |

## Other original DWGs

The remaining files are present but are not assigned to a campus ID. Similar names or thematic relationship are insufficient to establish which campus footprint the drawing represents, and none has a processed floor plan in the repository:

- `academic/`: `Civil Department.dwg`, `clasrroms at old library.dwg`, `Computer deptt NAC.dwg`, `Electronics depttdwg.dwg`, `IT NAC.dwg`.
- `hostels/`: `D5-D8 hostel Hostel.dwg` (grouped filename does not establish a one-to-one footprint mapping).
- `library/`: `New library  GF.dwg`, `old library.dwg`.
- `other/`: `APM NAC.dwg`, `Boys mess.dwg`, `Canteen.dwg`, `CCF NAC.dwg`, `Central store.dwg`, `college land.dwg`, `Director cabin layout.dwg`, `Director Second Floor.dwg`, `exam hall with toilet.dwg`, `Ladies Gymkhana.dwg`, `Ladies mess.dwg`, `Mini CCF computer laboratory.dwg`, `Old rector office to ladies hostel.dwg`, `Physics NAC.dwg`, `Quadrangle NAC.dwg`, `Rector office.dwg`, `Sathe hall.dwg`.

There are 33 original DWGs, two DXFs (campus source and Main Building conversion), and five SVGs under `public/campus-maps/`. All five SVGs are Main Building plan, inspection, underlay, or geometry experiment assets; only the Ground and First Floor underlays are used as floor references in the current interior viewer.

## Room data finding

There are no verified room records or room-boundary polygons in the available sources. Main Building CAD labels are literal source text annotations with unverified room associations, as detailed in the room-identification investigation. `WorkspacePage` contained hardcoded generic room records; the `/rooms` route now uses campus IDs and reports that room data is unavailable instead of presenting those examples as real rooms.
