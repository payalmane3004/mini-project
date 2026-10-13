# Main Building room and facility identification investigation

## Scope and method

- Inspected the original source path `public/campus-maps/academic/main building.dwg`, the existing conversion `public/campus-maps/processed/main-building-converted.dxf`, both floor underlays, both source-label JSON files, the Phase 1 inspection report, and the current Ground/First Floor architecture data.
- The original DWG is present (DWG signature `AC1032`) and was not changed. No DWG parser or ODA File Converter executable was available on the current command path, so this investigation could not independently reopen the DWG. Findings about its entities therefore come from the existing local DXF conversion. The Phase 1 report records the conversion as ODA File Converter 27.9 to ACAD2018 DXF.
- Converted DXF SHA-256: `19b0a6c2b3662305fce811b9fd8801424ee31d40b2c6fd1c94eef775c2bebf26`.
- The SVG references use the same source-space bounds as their floor label JSON: Ground Floor X `-20.4321..198.6996`, Y `30.3143..86.7941`; First Floor X `-18.3557..214.2158`, Y `115.8781..172.3591`. SVG viewBox rounding differs by at most `0.0001` drawing units. Coordinates are local and uncalibrated.

## Identifiable source labels

The names below are literal source `MTEXT` annotations, not verified room records. Their floor grouping is supported by their separate coordinate bands and the source floor-title annotations, but a label's relationship to an enclosed outline has not been established. Coordinates are DXF model-space insertion points `(X, Y)`.

### Ground Floor

| Source label | X | Y |
|---|---:|---:|
| R&D | 34.5519 | 75.4119 |
| (COMPUTER SCIENCE DEPT.) | 181.2031 | 74.7289 |
| UP | 44.2601 | 62.4576 |
| UP | 145.0728 | 76.2509 |
| Electrical/ PE Lab | 135.8759 | 54.6310 |
| Electrical/ PE Lab | 135.9348 | 45.1267 |
| Chemistry Lab/ CCF | -9.7184 | 75.8387 |
| (COMPUTER SCIENCE DEPT.) | 54.0348 | 73.5046 |
| (Electronics Dept.) | 102.8515 | 72.3942 |
| (Electronics Dept.) | 117.8725 | 72.4051 |
| P.G. Lab | 37.7285 | 46.6358 |
| Office Entrance | 83.9214 | 62.1110 |
| Mech Comp Lab | 18.6553 | 77.3280 |
| Metallurgy Lab | -14.8283 | 58.2423 |
| R&D | 34.5143 | 70.8733 |
| Conference Hall | 35.9980 | 58.9653 |
| Classroom N8 | 38.4283 | 73.8153 |
| Electronics Dept. | 94.3049 | 64.3088 |

### First Floor

| Source label | X | Y |
|---|---:|---:|
| W | 210.8289 | 159.9104 |
| E | 203.9193 | 159.1914 |
| N | 207.4648 | 151.0690 |
| UP | 147.3486 | 161.8157 |
| Electronics Dept. | 105.9358 | 158.6232 |
| Computer Dept | 47.8633 | 159.4682 |
| VP POLY | 36.9917 | 161.3514 |
| Electrical Lab | 138.4914 | 132.1991 |
| B.V. Bhandari | 145.6512 | 157.1303 |
| Chemistry Lab/ CCF | -7.7308 | 161.8265 |
| Metallurgy Lab/ CCF | -12.4790 | 142.7456 |
| Electronics Dept. | 121.2773 | 158.6395 |
| Electronics Dept. | 137.5114 | 158.1746 |
| Electronics Dept. | 153.2974 | 162.8953 |
| Electronics Dept. | 164.6803 | 163.1832 |
| DCS Dept. | 181.7491 | 163.1379 |
| Electrical Lab | 137.7408 | 139.9609 |
| VP POLY | 37.0077 | 156.4451 |
| IT DEPARTMENT | 39.9353 | 132.3039 |
| Classroom N2 | 20.9057 | 161.1204 |
| Classroom N1 | 9.9370 | 161.8106 |
| Conference Hall | 96.9564 | 159.8350 |
| Director | 86.0644 | 158.8818 |
| Deputy | 91.8329 | 161.0125 |
| Director | 91.7920 | 159.7045 |
| Kitchen | 76.3397 | 156.1202 |
| Toilet | 80.2740 | 155.5305 |
| Kitchen | 99.1519 | 155.0875 |
| Toilet | 96.3742 | 154.8757 |
| Electronics Dept. | 130.8034 | 158.9345 |

`UP` entries are source annotations associated spatially with repeated tread-like plan linework. `E`, `W`, and `N` are directional annotations. Repeated labels are preserved as separate source instances. None of these coordinates establish a room polygon or a verified room-to-label association.

## Converted DXF inventory and semantics

Model space contains:

| Entity type | Count | Finding |
|---|---:|---|
| LINE | 3,678 | Dense 2D linework; many parallel pairs and short segments, but no semantic wall/opening classification. |
| LWPOLYLINE | 129 | 128 closed loops on `window`; one large closed sheet/frame outline on layer `0`. |
| MTEXT | 53 | Includes the 48 floor annotations listed above and drawing/title annotations. |
| DIMENSION | 26 | Stored measurements range from 2.921 to 50.341 drawing units. They provide local dimension evidence, not a trusted overall scale. |
| LEADER | 6 | Present, but no verified room association was obtained from them. |
| INSERT | 2 | Both are `urinal_p07`, at `(136.6974, 119.1825)` and `(134.4219, 33.6186)`. |

The 45-layer table has four layers with model-space entities:

| Layer | Model-space contents |
|---|---|
| `window` | 3,603 LINE, 128 LWPOLYLINE, 48 MTEXT, 6 LEADER, 2 INSERT |
| `0` | 75 LINE, 1 LWPOLYLINE, 26 DIMENSION |
| `TEXT` | 4 MTEXT |
| `WALL` | 1 MTEXT |

Layer names that sound architectural—including `A-DOOR`, `A-Wall`, `CORRIDOOR`, `DOOR`, `WIN`, `staircase`, and `windowslit`—are defined in the layer table but contain no model-space entities. The mixed `window` layer cannot classify its entities as windows. The block table contains door-named definitions (`DOOR`, `Door toilet 900`, `0.75 M DOOR`), but no corresponding door block is inserted in model space; definitions alone are not evidence of a door at a plan location. The only model-space INSERTs are the two urinal blocks.

The DWG header declares inches, but the declaration is not validated against a trusted building measurement. The 26 local dimension values do not provide an independently verified scale. The DXF has no model-space ARC or CIRCLE entities, and the inspection found no reliable room-space records or dedicated room-boundary layer.

## Candidate room outlines and associations

- The 128 closed `window`-layer polylines are symbol-scale, with area no greater than `0.4162` square drawing units. They are not reliable room outlines. The one very large closed polyline is the sheet/frame on layer `0`, not a building room.
- Dense linework and parallel runs visibly subdivide the plans, but the drawing does not provide a consistent closed polygon or topological room model. Gaps, intersections, overlaps, and short segments prevent automatic boundary closure without making assumptions.
- The application architecture files contain eight coarse visualization zones per floor, not native DXF room outlines. Ground Floor zones have mixed `approximate-outline` and `reviewed-outline` statuses; even the reviewed outlines remain only broad floor areas, not room polygons. All First Floor zones are marked `approximate-outline`. None is assigned to a source label as a room.
- Candidate textual associations based on nearest label or nearest closed loop are not reliable enough to promote. Labels may lie within, between, or outside outlines due to text placement and building-wide annotations.

### Existing approximate zone extents (not room boundaries)

| Floor | Approximate zone IDs | DXF coordinate extent X / Y |
|---|---|---|
| Ground Floor | `west-chemistry-mechanical-block` | `-16.4..34.1` / `67.3..81.2` |
| Ground Floor | `west-side-metallurgy-wing` | `-16.4..-4.8` / `40.1..65.8` |
| Ground Floor | `west-upper-room-bar` | `34.1..81.6` / `65.0..77.1` |
| Ground Floor | `east-upper-room-bar` | `93.3..142.4` / `65.2..77.9` |
| Ground Floor | `far-east-room-wing` | `148.4..195.5` / `70.2..80.4` |
| Ground Floor | `west-pg-and-conference-wing` | `34.1..47.0` / `32.5..65.4` |
| Ground Floor | `east-electrical-wing` | `132.5..143.1` / `33.0..65.8` |
| Ground Floor | `office-entrance-projection` | `80.6..96.8` / `56.4..65.3` |
| First Floor | `first-west-upper-wing` | `-14.2..30.2` / `151.0..165.9` |
| First Floor | `first-central-upper-west-wing` | `30.2..82.9` / `150.7..163.2` |
| First Floor | `first-central-upper-east-wing` | `97.77..144.7` / `150.8..163.6` |
| First Floor | `first-far-east-wing` | `151.1..197.8` / `155.7..165.8` |
| First Floor | `first-west-side-wing` | `-14.2..-2.5` / `125.7..151.4` |
| First Floor | `first-west-lower-wing` | `31.7..49.3` / `118.1..150.9` |
| First Floor | `first-east-lower-wing` | `134.8..145.4` / `118.5..151.4` |
| First Floor | `first-central-projection` | `82.8..97.77` / `143.5..153.6` |

## Features that can be extracted reliably

- Literal MTEXT strings, entity types, layer assignments, insertion coordinates, and floor-band grouping can be exported without assigning labels to rooms.
- Raw LINE and LWPOLYLINE vertices, block definitions/references, and dimension values can be inventoried. These are geometric facts; their architectural meanings still need review.
- Three `UP` labels lie next to repeated tread-like linework: Ground Floor `(44.2601, 62.4576)` and `(145.0728, 76.2509)`, First Floor `(147.3486, 161.8157)`. The current viewer's plan-only tread traces are supported as plan linework. Their riser heights and floor-to-floor connections cannot be recovered from these marks.
- The current 32 Ground Floor and 24 First Floor reviewed wall runs can be compared visually with the CAD references. “Reviewed” means visually checked against selected linework; the shared ambiguous layer prevents those runs from being treated as authoritative wall classifications.

## Requires manual confirmation

- Which line pairs are walls, partitions, facade edges, fixtures, or annotation geometry.
- Which line gaps represent doors, windows, openings, or simply incomplete/drafted linework. The block definitions named for doors are not model-space insertions; no door/window layers are populated.
- Closed room boundaries and the mapping from each text label to a particular enclosed area.
- Which open circulation areas are corridors and where their boundaries lie. No reliable separate corridor entities or labels were identified.
- Whether each stair mark represents a complete stair flight, its rise, landings, and connection between floors.
- Physical scale, wall thickness/height, floor-to-floor height, and present-day facility use.
- Whether the converted DXF fully preserves layer, block, and entity semantics from the original DWG. The source DWG requires inspection in a compatible CAD application to confirm conversion fidelity and source-layer intent.

## Conclusion

The drawings reliably identify a set of facility names as text annotations and provide their source coordinates and probable floor grouping. They do **not** reliably associate those labels with closed room boundaries. Candidate room outlines cannot be extracted automatically from the current DXF without substantial manual interpretation. The defensible next step is assisted manual tracing against the original DWG with a knowledgeable reviewer confirming room boundaries, door/window symbols, and label associations; retain all unconfirmed geometries as candidates until then.

## Files and preservation

- Report created: `docs/cad-inspection/main-building-room-identification-investigation.md`.
- The original DWG, converted DXF, both underlay SVGs, application source, architecture data, footprint JSON, coordinates, and viewer transforms were not modified.
