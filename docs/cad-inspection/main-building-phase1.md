# Main Building CAD inspection — Phase 1

## Source and method

- Original source: `public/campus-maps/academic/main building.dwg` (unchanged).
- Inspected converted file: `public/campus-maps/processed/main-building-converted.dxf`.
- Conversion: ODA File Converter 27.9, DWG to ACAD2018 DXF, local/offline. The existing production SVG was not overwritten.
- Converted DXF SHA-256: `19b0a6c2b3662305fce811b9fd8801424ee31d40b2c6fd1c94eef775c2bebf26`.
- DXF inspection is limited to model-space entities and header/table metadata; block definitions are not expanded into presumed walls.

## Units, extents, and dimensions

- `$INSUNITS` declares **inches** (code 1); `$MEASUREMENT` is 0 and `$DIMLFAC` is 1.0.
- Header extents: X `-39.555..262.712`, Y `-17.132..198.668`, Z `0.0..0.0` (302.267 by 215.800 drawing units). These include the sheet/frame extent.
- 26 DIMENSION entities have measured values from `2.921` to `50.341` drawing units; dimension text is generated through anonymous dimension blocks and no group-1 text overrides were found.
- The header's inch declaration is not safe to treat as verified physical scale: the drawing's local layout extents and dimension values do not provide a known overall building measurement to cross-check the units. No unit conversion or scale factor has been applied.
- No wall-height or floor-to-floor-height data was found in the inspected model-space entities/header. Wall heights remain unknown.

## Model-space entity inventory

| Entity | Count |
|---|---:|
| `LINE` | 3678 |
| `LWPOLYLINE` | 129 |
| `MTEXT` | 53 |
| `DIMENSION` | 26 |
| `LEADER` | 6 |
| `INSERT` | 2 |

### Layer findings

| Layer | Model-space entities |
|---|---|
| `window` | LINE 3603, LWPOLYLINE 128, MTEXT 48, LEADER 6, INSERT 2 |
| `0` | LINE 75, DIMENSION 26, LWPOLYLINE 1 |
| `TEXT` | MTEXT 4 |
| `WALL` | MTEXT 1 |

- The layer table defines 45 layers. The following architectural layer names are present but have no model-space entities: `A-DOOR`, `A-Wall`, `CORRIDOOR`, `DOOR`, `STONE-WALL`, `WIN`, `staircase`, `windowslit`.
- Nearly all plan linework, labels, leaders, and the two INSERTs are assigned to the single lowercase layer `window`; its name therefore cannot be used to classify those entities as actual windows. The `WALL`, `DOOR`, `WIN`, `staircase`, `CORRIDOOR`, and `A-Wall` table names are not populated with model-space wall/opening geometry.

## Floor layouts and labels

- The source contains MTEXT title labels `Ground Floor` at Y `16.976` and `First Floor` at Y `106.859`. Their plan linework occupies separate lower and upper local-coordinate regions, split diagnostically at Y `104.764` (the split is inferred from text clusters, not a CAD floor layer).
- Ground Floor candidate linework bounds: `x=-17.24..195.51, y=32.41..84.70`.
- First Floor candidate linework bounds: `x=-14.97..210.53, y=117.97..170.27`.
- The drawing title text reads `Main Building`; the sheet heading reads `WALCHAND COLLEGE OF ENGINEERING, SANGLI`. Other source text includes: `(COMPUTER SCIENCE DEPT.)`; `(Electronics Dept.)`; `B.V. Bhandari`; `Chemistry Lab/CCF`; `Classroom N1`; `Classroom N2`; `Classroom N8`; `Computer Dept`; `Conference Hall`; `DCS Dept.`; `Deputy`; `Director`; `E`; `Electrical Lab`; `Electrical/PE Lab`; `Electronics Dept.`; `IT DEPARTMENT`; `Kitchen`; `Mech Comp Lab`; `Metallurgy Lab`; `Metallurgy Lab/CCF`; `N`; `Office Entrance`; `P.G. Lab`; `R&D`; `S`; `Toilet`; `UP`; `VP POLY`; `W`.
- Three `UP` MTEXT markers were found at `(147.35, 161.82)`, `(44.26, 62.46)`, `(145.07, 76.25)`. They may indicate stairs, but no stair geometry was isolated by layer or entity type. No reliable separate corridor entities were identified.
- Labels and floor titles are annotations only. No room-number-to-boundary relationships or room polygons were derived.

## Boundary and opening assessment

- There are 3678 model-space LINEs and 129 closed LWPOLYLINEs. Of the closed polylines, 128 are on the ambiguous `window` layer; their enclosed areas are small (maximum `0.416` square drawing units). The only large closed outline is the sheet/frame on layer `0`, not a room boundary.
- Wall-like parallel line pairs may be present in the 3,603 LINEs assigned to `window`, but the converted file presents most entities on this one ambiguous layer. It is not established whether that reflects the source DWG or the conversion. Together with the lack of closed room outlines, this prevents reliable wall/room extraction. Treat this linework as unclassified candidates, not confirmed walls.
- Explicit model-space DOOR/WIN/staircase/corridor layer geometry was not found. The two INSERTs are both named `urinal_p07`; no door/window INSERTs are present. Openings cannot be distinguished reliably from nearby linework.
- The 26 dimensions may help with local measurements, but without a trusted overall dimension or agreement between declared units and known building size they do not establish a reliable global scale.

## Reconstruction readiness and recommendation

**Not ready for reliable automatic 3D wall/room reconstruction.** The DXF has useful floor labels, room text, and dense plan linework, but the converted file presents most active plan linework and labels on one ambiguous layer, closed loops do not correspond to room boundaries, openings are not classified, and the header's unit declaration cannot be independently validated. Wall heights are absent.

1. Confirm one labeled dimension against a trusted measured building dimension and establish the intended model units/scale.
2. Review the original DWG in a CAD viewer with layer visibility and block inspection, and compare its assignments with the converted DXF; identify actual wall centerlines/edges, door/window openings, and stairs on each floor.
3. Trace/validate closed room boundaries per floor and associate labels manually only where the drawing clearly supports them.
4. Obtain surveyed wall and floor-to-floor heights before creating 3D walls. Keep unmatched areas as unresolved linework rather than inferred rooms.

## Diagnostic artifact

- `public/campus-maps/processed/main-building-inspection.svg` colors all candidate LINEs orange, small closed LWPOLYLINEs magenta, and CAD text blue. These are explicitly unverified candidates/annotations; dimension objects, leaders, block contents, and sheet geometry are omitted from that split view.
- No campus coordinates, camera settings, footprint JSON, source DWG, or existing `main-building.svg` were modified by the inspection.
