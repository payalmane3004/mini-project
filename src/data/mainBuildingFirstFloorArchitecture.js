/**
 * Assisted First Floor architectural trace for the Main Building.
 * Coordinates are taken from the converted DXF local model space and retain
 * the source orientation. Polygons are visualization zones, not verified
 * room boundaries. Wall runs are reviewed against the visible CAD linework;
 * the ambiguous source layer means they are not construction-verified.
 */
export const mainBuildingFirstFloorArchitecture = {
  source: "public/campus-maps/processed/main-building-converted.dxf",
  coordinateSystem: "Converted DXF local coordinates; same center, orientation, and scale as the First Floor SVG underlay.",
  visualization: {
    wallHeight: 2.8,
    wallThickness: 0.14,
    floorThickness: 0.18,
    note: "Illustrative display values only; no measured heights or thicknesses are present in the source.",
  },
  floorZones: [
    { id: "first-west-upper-wing", points: [[-14.2, 151.0], [30.2, 151.0], [30.2, 165.9], [-14.2, 165.9]], status: "approximate-outline", evidence: "Coarse surface under the source linework in the west upper wing; polygon corners interpolate between CAD segments." },
    { id: "first-central-upper-west-wing", points: [[30.2, 150.7], [82.9, 150.8], [82.9, 163.2], [30.2, 163.0]], status: "approximate-outline", evidence: "Follows the west central upper bar extents and visible long court-side edge; not a room boundary." },
    { id: "first-central-upper-east-wing", points: [[97.77, 150.8], [144.7, 151.0], [144.7, 163.6], [97.77, 163.3]], status: "approximate-outline", evidence: "Starts at the long upper-bar CAD edge near X 97.77; the nearby X 93.2 line belongs to the separate central projection, so the intervening open span is left uncovered." },
    { id: "first-far-east-wing", points: [[151.1, 155.7], [197.8, 156.1], [197.7, 165.8], [151.1, 165.5]], status: "approximate-outline", evidence: "Coarse floor surface within the distinct far-east CAD block; connector and facade breaks are not reconstructed." },
    { id: "first-west-side-wing", points: [[-14.2, 125.7], [-2.5, 125.7], [-2.5, 151.4], [-14.2, 151.4]], status: "approximate-outline", evidence: "Follows the west side-wing outer extent visible in the source; no internal room polygons inferred." },
    { id: "first-west-lower-wing", points: [[31.7, 118.1], [49.3, 118.2], [49.3, 150.9], [31.7, 150.9]], status: "approximate-outline", evidence: "Coarse zone beneath the upper bar at the source linework extents; gaps remain as drawn in the CAD reference." },
    { id: "first-east-lower-wing", points: [[134.8, 118.5], [145.4, 118.6], [145.4, 151.4], [134.8, 151.4]], status: "approximate-outline", evidence: "Coarse zone beneath the east upper bar at the source linework extents; no rooms or stair geometry are inferred." },
    { id: "first-central-projection", points: [[82.8, 143.5], [97.77, 143.6], [97.77, 153.6], [82.8, 153.5]], status: "approximate-outline", evidence: "Surface beneath the distinct central projection linework; its east edge is clipped to the adjacent CAD bar start near X 97.77 to avoid covering the open span." },
  ],
  reviewedWallRuns: [
    // West upper wing: visible perimeter and repeated classroom divisions.
    { id: "first-west-upper-south-edge", points: [[8.2, 154.95], [29.78, 155.05]], evidence: "Source horizontal CAD segment, endpoints retained." },
    { id: "first-west-classroom-partition-01", points: [[8.06, 159.69], [8.07, 165.26]], evidence: "Repeated vertical partition line in the west upper block." },
    { id: "first-west-classroom-partition-02", points: [[18.95, 159.72], [18.95, 165.30]], evidence: "Repeated vertical partition line in the west upper block." },
    { id: "first-west-upper-west-edge", points: [[-13.55, 151.0], [-13.56, 155.46]], evidence: "Visible west facade segments; gaps elsewhere are preserved." },

    // Central upper wings and repeated internal partitions.
    { id: "first-central-west-court-edge", points: [[52.63, 150.63], [82.85, 150.77]], evidence: "Long source boundary segment facing the open central area." },
    { id: "first-central-east-court-edge", points: [[97.77, 150.84], [128.36, 150.98]], evidence: "Long source boundary segment facing the open central area." },
    { id: "first-central-west-partition-01", points: [[46.88, 153.31], [46.88, 162.46]], evidence: "Centerline of paired near-parallel source edges around X 46.70/47.07." },
    { id: "first-central-west-partition-02", points: [[54.17, 153.35], [54.17, 162.50]], evidence: "Centerline of paired near-parallel source edges around X 53.98/54.35." },
    { id: "first-central-east-partition-01", points: [[103.58, 153.58], [103.58, 162.73]], evidence: "Centerline of paired near-parallel source edges around X 103.51/103.61." },
    { id: "first-central-east-partition-02", points: [[129.66, 153.70], [129.66, 162.85]], evidence: "Centerline of paired near-parallel source edges around X 129.45/129.82." },
    { id: "first-central-west-upper-crosswall", points: [[38.44, 163.08], [54.85, 163.12]], evidence: "Source horizontal line at the upper edge of the visible block." },

    // Far-east block and its drawn divisions.
    { id: "first-far-east-south-edge", points: [[151.16, 155.76], [176.60, 155.88]], evidence: "Long source boundary segment, endpoints retained." },
    { id: "first-far-east-east-end", points: [[197.79, 156.19], [197.74, 165.73]], evidence: "Source end-wall segment at the east extent." },
    { id: "first-far-east-partition", points: [[176.77, 158.0], [176.60, 165.7]], evidence: "Centerline of near-parallel vertical partition edges around X 176.55/176.93." },

    // Side wings below the upper bars.
    { id: "first-west-side-east-edge", points: [[-2.60, 151.41], [-2.48, 125.67]], evidence: "Long source side-wing boundary segment; CAD endpoints preserved." },
    { id: "first-west-side-west-edge", points: [[-5.52, 151.40], [-5.48, 132.85]], evidence: "Centerline of near-parallel source edges around X -5.56/-5.48." },
    { id: "first-west-lower-south-edge", points: [[35.92, 118.09], [46.32, 118.14]], evidence: "Source horizontal edge along the south end of the lower west wing." },
    { id: "first-west-lower-east-edge", points: [[46.18, 147.09], [46.16, 150.95]], evidence: "Visible vertical CAD segment near the east side of the lower west wing." },
    { id: "first-east-lower-west-edge", points: [[134.82, 147.51], [134.97, 118.55]], evidence: "Source vertical boundary segments along the west side of the lower east wing." },
    { id: "first-east-lower-east-edge", points: [[144.69, 141.36], [144.74, 121.37]], evidence: "Centerline of paired long source edges around X 144.64/145.26." },
    { id: "first-east-lower-south-edge", points: [[134.97, 118.55], [145.37, 118.60]], evidence: "Source horizontal edge at the lower end of the east wing." },

    // Central projection and visible connecting lines.
    { id: "first-central-projection-crosswall", points: [[83.26, 143.56], [93.21, 143.61]], evidence: "Source horizontal segment at the south end of the projection linework." },
    { id: "first-central-projection-west-edge", points: [[82.85, 143.56], [82.85, 150.77]], evidence: "Visible source boundary at the west side of the central projection." },
    { id: "first-central-east-crossline", points: [[135.52, 135.05], [144.67, 135.10]], evidence: "Source horizontal segment; retained as linework without assigning a room function." },
  ].map((run) => ({ ...run, status: "reviewed" })),
  stairPlanTraces: [
    {
      id: "first-east-up-stair-plan",
      status: "reviewed-plan-linework",
      upLabel: [147.349, 161.816],
      evidence: "A nearby UP MTEXT label and six repeated parallel CAD segments support this stair-plan interpretation. Tread positions are traced from source coordinates; no riser height or floor connection is inferred.",
      treads: [
        [[144.707, 159.592], [150.675, 159.620]],
        [[144.706, 159.891], [150.673, 159.919]],
        [[144.704, 160.189], [150.672, 160.217]],
        [[144.703, 160.487], [150.670, 160.515]],
        [[144.702, 160.786], [150.669, 160.814]],
        [[144.700, 161.084], [150.668, 161.112]],
      ],
    },
  ],
  candidateWallRuns: [],
  roomBoundaries: [],
  openings: [],
  stairs: [],
  unverifiedFeatureCandidates: [
    { feature: "doors and openings", status: "unverified", rendered: false, evidence: "Line gaps and short marks occur in the mixed source linework; no reliable door entities or swing symbols were isolated." },
    { feature: "windows", status: "unverified", rendered: false, evidence: "Repeated facade details are visible, but the active entities share an ambiguous layer and do not establish window function." },
    { feature: "corridor boundaries", status: "unverified", rendered: false, evidence: "No distinct corridor layer or reliable corridor boundary entities were identified; circulation boundaries remain unresolved." },
    { feature: "stair elevation and connections", status: "unverified", rendered: false, evidence: "The plan indicates tread spacing and an UP annotation only; riser heights and floor-to-floor connections are not available." },
  ],
  limitations: [
    "Reviewed means visually checked against visible source linework, not construction-verified; active entities share an ambiguous source layer.",
    "Floor zones are coarse visualization surfaces, not room polygons or a verified continuous exterior footprint.",
    "Wall heights and thicknesses are illustrative values shared with the Ground Floor.",
    "CAD text remains at source coordinates; no label-to-room association is asserted.",
    "Stair traces reproduce supported tread-like plan segments only; no vertical stair geometry is reconstructed. Doors and windows remain unclassified, and apparent line breaks are not bridged.",
  ],
};
