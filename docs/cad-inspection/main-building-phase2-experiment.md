# Main Building geometry analysis — Phase 2 experiment

## Scope and safeguards

- Input: `public/campus-maps/processed/main-building-converted.dxf` (read-only). Source coordinates and source entities are retained; no scale conversion, snapping, line merging, or room generation is performed.
- This is a screening experiment. Parallel pairs are visual review candidates only, not verified walls. No application component or campus geometry is changed.

## Entity attribute evidence

- 2295 LINE segments (length >= 1.0 DXF unit) entered geometric screening. Their layer counts: `{'window': 2248, '0': 47}`.
- Explicit LINE linetypes: `{'BYLAYER': 2295}`. Explicit color indices: `{'BYLAYER': 2295}`; BYLAYER means the DXF entity does not distinguish the items through that attribute.
- Block INSERTs remain the two `urinal_p07` instances from Phase 1; this test does not expand block geometry. Entity type, linetype, and explicit color do not currently supply architectural classification.

## Repeated geometry screening

- Tested LINE segments at or above 1.0 drawing unit for near-parallel alignment, separation <= 0.18 source units, and at least 72% shared projected length (or 0.65 units).
- Found 45 paired relationships involving 84 distinct LINE entities. Pair separations range `0.0334..0.1685` source units.
- Sensitivity check: pair counts at separation tolerances 0.18, 4, and 12 source units are `{0.18: 45, 4.0: 4500, 12.0: 9512}`. The broad tolerances rapidly produce thousands of overlapping pair matches, demonstrating that proximity alone is not discriminative.
- Pairing can expose repeated double-line patterns, but dimensions, furniture, fixtures, symbols, and wall edges can all produce such pairs. The drawing gives no independent layer, block, linetype, or color evidence to resolve those alternatives. Pair membership alone is insufficient to call a wall.
- Endpoint intersections/connectivity may describe a line graph, but do not establish which connected loops are rooms: openings, fragmented drawing strokes, symbols, and annotations can create or break cycles. The Phase 1 closed-polylines result likewise does not support room boundary extraction.
- Text labels are nearby annotations, but there are no CAD topology links tying a label to a closed room outline. Automated label-to-room assignment would be speculative.

## Scale and reconstruction decision

- The drawing declares inches and contains 26 dimension entities (2.921–50.341 DXF units), but no trusted reference dimension is available to validate the unit declaration or scale. Dimensions can be reviewed in a CAD editor; this analysis does not calibrate geometry.
- **Recommendation: assisted tracing from the source drawing**, after verifying a dimension and inspecting source layer visibility/blocks in an AutoCAD-compatible editor. The converted DXF can then serve as an underlay; a reviewer can classify wall runs, openings, stairs, and room outlines. Automatic extraction is not reliable from the current evidence. Fully manual redrafting is only needed if trustworthy source geometry cannot be separated or traced.
- Before 3D construction, confirm scale and collect wall/floor heights. Keep unresolved openings and room boundaries explicitly unresolved; this analysis does not infer either.

## Diagnostic

- `public/campus-maps/processed/main-building-geometry-experiment.svg` shows original LINEs gray, close-parallel LINE candidates red, closed LWPOLYLINEs magenta, and source text blue, separated into inferred floor-coordinate bands. Colors indicate screening status only.
