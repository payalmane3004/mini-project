# Main Building prototype alignment check

## Ground Floor reference selection

The converted DXF Ground Floor plan linework bounds are X `-17.2409..195.5084`, Y `32.4062..84.7022`. In the converted file, all entities in the inferred Ground Floor band (`25 <= Y < 104.764`) are on the mixed `window` layer and fall inside the underlay export filter. The exported Ground Floor underlay includes 1,873 LINE, 64 LWPOLYLINE, and 18 MTEXT entities (1,955 entities total). No entities in that band were excluded by its current coordinate filter. Annotation/title and sheet geometry outside the Ground Floor band are deliberately excluded.

The generated SVG viewBox is `-20.4321 -86.7941 219.1317 56.4797`: it adds proportional 1.5% X and 4% Y padding around the selected source coordinates. Its background is transparent, so its rectangular canvas is not rendered as building floor.

## Shared 2D/3D coordinates

The model bounds derive from the same source viewBox: X `-20.4321..198.6996`, Y `30.3144..86.7941`. Both the 2D source image and the SVG texture use the original aspect ratio. The Three.js floor plane has width `219.1317 * scale` and depth `56.4797 * scale`; it is rotated to map DXF +Y toward scene -Z. The transform is:

```text
localX = (DXF_X - centerX) * scale
localZ = -(DXF_Y - centerY) * scale
```

The comparison mode shows the 2D SVG alongside a top-down camera option in the 3D pane. This allows direct visual alignment checks in the app at `/main-building-interior`.

## Building floor outline

The former full rectangular box slab has been replaced by 11 editable floor-outline patches in `src/data/mainBuildingGroundFloorTrace.js`. They follow the major stepped wing projections and leave the broad central gap open. They are approximate silhouette traces, not a closed CAD boundary and not room shapes. Their outer edges still require visual review against the source DWG.

All 1,937 source LINE/LWPOLYLINE elements remain unclassified reference geometry; the layer is mixed and cannot be treated as an automatic wall set. The eight illustrative wall runs are still amber candidates and are not derived automatically from all reference lines. No room boundaries, doors, windows, or stair solids are claimed.
