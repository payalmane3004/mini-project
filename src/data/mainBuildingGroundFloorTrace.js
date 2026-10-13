/**
 * Editable assisted trace for the Main Building Ground Floor prototype.
 * XY values use the converted DXF's local source coordinates (not campus coordinates).
 * Edit this file to add, adjust, review, or remove trace runs. The React renderer
 * consumes the data and does not contain building-specific line coordinates.
 * Every current run is an unverified visual candidate, not a verified wall.
 */
export const mainBuildingGroundFloorTrace = {
  source: "public/campus-maps/processed/main-building-converted.dxf",
  coordinateSystem: {
    kind: "interior-local-derived-from-dxf",
    xRange: [-20.4321, 198.6996],
    yRange: [30.3143, 86.7941],
    note: "Uncalibrated source drawing coordinates; visualization uses uniform scale only.",
  },
  visualization: {
    scale: 0.17,
    wallHeight: 2.8,
    wallThickness: 0.14,
    floorThickness: 0.18,
    note: "Illustrative visualization values only; not surveyed or construction dimensions.",
  },
  // Approximate outer-floor outline components, traced from the plan silhouette.
  // These polygons are foundation patches only; they are not room boundaries.
  floorFootprint: {
    status: "approximate-outline-trace",
    polygons: [
      { id: "west-main-wing", points: [[27.5, 65.2], [81.7, 65.2], [81.7, 81.4], [27.5, 81.4]] },
      { id: "east-main-wing", points: [[93.2, 65.2], [148.7, 65.2], [148.7, 81.4], [93.2, 81.4]] },
      { id: "far-east-wing", points: [[148.7, 69.8], [195.5, 69.8], [195.5, 81.4], [148.7, 81.4]] },
      { id: "west-upper-projection", points: [[5.5, 69.2], [27.5, 69.2], [27.5, 80.4], [5.5, 80.4]] },
      { id: "west-upper-link", points: [[5.5, 65.2], [27.5, 65.2], [27.5, 69.2], [5.5, 69.2]] },
      { id: "west-side-wing", points: [[-16.4, 40.0], [-8.1, 40.0], [-8.1, 69.8], [-16.4, 69.8]] },
      { id: "west-wing-connector", points: [[-8.1, 65.2], [5.5, 65.2], [5.5, 69.8], [-8.1, 69.8]] },
      { id: "south-west-projection", points: [[34.0, 32.4], [47.1, 32.4], [47.1, 65.2], [34.0, 65.2]] },
      { id: "central-entrance-projection", points: [[80.5, 56.2], [96.9, 56.2], [96.9, 65.2], [80.5, 65.2]] },
      { id: "south-east-projection", points: [[130.2, 32.8], [143.2, 32.8], [143.2, 65.2], [130.2, 65.2]] },
      { id: "east-wing-connector", points: [[148.7, 67.0], [174.5, 67.0], [174.5, 69.8], [148.7, 69.8]] },
    ],
    note: "Approximate outline components follow visible exterior plan runs. They are not survey-verified and do not define rooms.",
  },
  verification: "unverified-assisted-trace",
  // Copy a run object to add one, edit its points to adjust it, or remove it
  // from this array. Only set status to "reviewed" after checking it against
  // the source CAD; the viewer gives reviewed and candidate runs different styles.
  wallRuns: [
    // Upper bar, west half: its parallel long edges and repeated partitions are visible in the DXF.
    { id: "west-upper-bar-edges", status: "candidate", notes: "Long west-side bar edges traced from the Ground Floor linework; exact wall/window interpretation remains unreviewed.", points: [[34.14, 77.3], [44.45, 77.2], [52.0, 77.2], [59.3, 77.2], [66.7, 77.2], [73.9, 77.2], [80.7, 77.2], [80.7, 67.4], [73.9, 67.4], [66.6, 67.4], [59.4, 67.4], [52.0, 67.4], [44.5, 67.4], [34.14, 67.4]] },
    { id: "west-upper-bar-partitions", status: "candidate", notes: "Repeated transverse divisions visible between the bar's long edges; openings and room boundaries are not classified.", points: [[34.2, 67.4], [34.2, 77.2], [44.5, 77.2], [44.5, 67.4], [52.0, 67.4], [52.0, 77.2], [59.3, 77.2], [59.3, 67.4], [66.7, 67.4], [66.7, 77.2], [73.9, 77.2], [73.9, 67.4], [80.7, 67.4], [80.7, 77.2]] },
    // Upper bar, east half. The large gap in the middle is kept open as drawn.
    { id: "east-upper-bar-edges", status: "candidate", notes: "East-side bar and far-east projection traced from source; verify all edge segments and apertures.", points: [[93.4, 77.2], [101.3, 77.2], [108.4, 77.2], [116.2, 77.2], [123.2, 77.2], [130.6, 77.2], [138.0, 77.2], [142.4, 77.2], [142.4, 70.2], [148.9, 70.2], [174.3, 70.2], [174.3, 80.5], [195.5, 80.5], [195.5, 70.6], [174.3, 70.6], [174.3, 67.4], [148.4, 67.4], [142.4, 67.4], [138.0, 67.4], [130.6, 67.4], [123.2, 67.4], [116.2, 67.4], [108.4, 67.4], [101.3, 67.4], [93.4, 67.4]] },
    { id: "east-upper-bar-partitions", status: "candidate", notes: "Repeated transverse divisions visible in the east-side bar; boundaries remain unreviewed.", points: [[93.4, 67.4], [93.4, 77.2], [101.3, 77.2], [101.3, 67.4], [108.4, 67.4], [108.4, 77.2], [116.2, 77.2], [116.2, 67.4], [123.2, 67.4], [123.2, 77.2], [130.6, 77.2], [130.6, 67.4], [138.0, 67.4], [138.0, 77.2], [142.4, 77.2], [142.4, 67.4]] },
    // West projection and the two narrow lower projections retain the source's stepped footprint.
    { id: "west-projecting-wing", status: "candidate", notes: "West-side projecting wing outer edges and divisions; uncertain line types are retained as candidates.", points: [[-16.3, 40.1], [-16.3, 65.4], [-8.2, 65.4], [-8.2, 69.9], [5.9, 69.9], [27.5, 69.9], [27.5, 65.4], [34.1, 65.4]] },
    { id: "south-west-projection", status: "candidate", notes: "Narrow south projection near source X 34–47; CAD linework is dense and may include symbols.", points: [[34.2, 65.0], [34.2, 58.9], [43.9, 58.9], [43.9, 32.5], [47.0, 32.5]] },
    { id: "south-east-projection", status: "candidate", notes: "Narrow south projection near source X 130–143; CAD linework is dense and may include symbols.", points: [[130.4, 65.8], [130.4, 61.5], [133.2, 61.5], [133.2, 33.0], [142.4, 33.0], [142.4, 55.8]] },
    { id: "central-entry-projection", status: "candidate", notes: "Small central projection at source X 80–97 and Y 56–65; exact enclosed geometry unverified.", points: [[80.6, 65.2], [80.6, 56.4], [96.8, 56.4], [96.8, 65.2]] },
  ],
  openings: [],
  roomBoundaries: [],
  stairCues: [
    { id: "up-label-west", sourceLabel: "UP", sourcePosition: [44.26, 62.46], status: "label-only; stair geometry unverified" },
    { id: "up-label-east", sourceLabel: "UP", sourcePosition: [145.07, 76.25], status: "label-only; stair geometry unverified" },
  ],
};
