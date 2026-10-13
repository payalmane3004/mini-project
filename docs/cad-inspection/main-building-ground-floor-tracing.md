# Main Building Ground Floor trace workflow

This prototype uses the converted DXF only as a visible reference. It does not automatically extract or classify walls.

## Coordinate mapping

The underlay SVG was cropped from the converted DXF's Ground Floor coordinate band. Its viewBox is `-20.432 -86.794 219.132 56.480`. The viewer floor uses the same bounds and a uniform illustrative scale of `0.17`:

```text
localX = (dxfX - centerX) * scale
localZ = -(dxfY - centerY) * scale
centerX = (-20.432 + 198.700) / 2
centerY = (30.314 + 86.794) / 2
```

DXF +X maps to viewer +X; DXF +Y maps to viewer -Z. No campus transform or georeferencing is applied. The SVG and floor plane share bounds, so source linework overlays the same drawing coordinates as the trace.

## Editing runs

Edit `src/data/mainBuildingGroundFloorTrace.js`; the React renderer reads the data and needs no building-specific changes.

- **Add:** append an object to `wallRuns` with a unique `id`, `points` (`[dxfX, dxfY]` pairs), `status: "candidate"`, and a short `notes` field.
- **Adjust:** change the point coordinates. Intermediate points create connected wall segments.
- **Remove:** delete that run object from the array.
- **Review:** only after checking a run against the source drawing, change its `status` to `"reviewed"`. Candidate runs display amber and translucent; reviewed runs display opaque blue. No current run is reviewed or verified.
- Change illustrative `scale`, `wallHeight`, `wallThickness`, and `floorThickness` under `visualization` to tune display only.

Keep door gaps as unresolved until their location is identifiable in the source. Do not enter room polygons, windows, or stair geometry without evidence. The two `UP` markers are CAD text cues, not modeled stairs.

## Current trace scope

Eight approximate polyline runs capture the two separated upper room bars, their transverse divisions, the west-side projection, two narrow lower projections, and the small central projection visible in the Ground Floor drawing. They are an initial spatial trace only. The source's `window` layer contains mixed, unclassified entities; the trace does not turn all underlay lines into walls. Room boundaries/openings/stairs are not verified and remain absent. Height and thickness values are visualization choices, not source measurements.
