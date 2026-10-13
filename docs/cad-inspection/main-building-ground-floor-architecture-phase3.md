# Main Building Ground Floor architectural trace

## What was traced

The converted DXF and Ground Floor SVG were inspected together. The source drawing shows three separated upper room bars (west, east, and far east), a large unbuilt/open central court, a west side wing containing the source-labeled Metallurgy Lab, a lower west wing with Conference Hall and P.G. Lab labels, an east Electrical/PE Lab wing, and a central Office Entrance projection.

`src/data/mainBuildingGroundFloorArchitecture.js` now holds eight floor zones and 32 reviewed wall runs in the converted DXF's local coordinates. The reviewed runs follow visible source line segments or centerlines between repeated parallel edges. They stop at source endpoints and do not bridge the visible breaks. Source labels continue to use their source DXF coordinates and remain unassociated with traced spaces.

The SVG and 3D scene use the same floor bounds, uniform illustrative scale, and orientation: DXF +X maps to local +X and DXF +Y maps to local -Z. A top-down overlay check showed the traced partitions align with the west/east upper room bars, the central projection, the lower side wings, and the far-east block. The large open court remains clear.

## Confidence and limits

“Reviewed” means visually checked against the converted drawing; it does not mean construction-verified. The active source linework is assigned to the ambiguous `window` layer, so entity-layer metadata cannot prove whether a line is a wall, opening, or another architectural feature. Parallel pairs and repeated room divisions support the runs included in the reviewed trace, but façade details remain incomplete.

The eight floor zones are illustrative surfaces. Several follow measured-looking source endpoints while the west Chemistry/Mechanical block and some outer corners remain coarse outline traces. They are not closed source polylines. No closed room-boundary data has been added, and labels are not assigned to rooms. Doors, windows, stairs, heights, and construction dimensions remain unmodeled or unknown. The earlier eight wall candidates remain separate, unverified, and hidden by default.

Wall height (2.8 local units), thickness (0.14), floor thickness (0.18), and overall display scale (0.17) are visualization settings only.
