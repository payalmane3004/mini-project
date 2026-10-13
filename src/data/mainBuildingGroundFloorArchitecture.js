/**
 * Assisted architectural trace of Main Building Ground Floor.
 * All coordinates are from the converted DXF's local model space. This file
 * deliberately separates visible CAD linework reviewed as a wall trace from
 * the older broad, unreviewed wall candidates in mainBuildingGroundFloorTrace.
 * Outline zones remain illustrative floor surfaces, not surveyed boundaries.
 */
export const mainBuildingGroundFloorArchitecture = {
  source: "public/campus-maps/processed/main-building-converted.dxf",
  coordinateSystem: "Converted DXF local coordinates; same center, orientation, and scale as the SVG underlay.",
  visualization: {
    wallHeight: 2.8,
    wallThickness: 0.14,
    floorThickness: 0.18,
    note: "Illustrative display values only; no measured heights or thicknesses are present in the source.",
  },
  floorZones: [
    {
      id: "west-chemistry-mechanical-block",
      points: [[-16.4, 67.3], [34.1, 67.3], [34.1, 81.2], [-16.4, 81.2]],
      status: "approximate-outline",
      evidence: "Coarse zone traced from the labelled Chemistry Lab/CCF and Mech Comp Lab block in the source plan; corners are not closed source room polylines.",
    },
    {
      id: "west-side-metallurgy-wing",
      points: [[-16.4, 40.1], [-4.8, 40.1], [-4.8, 65.8], [-16.4, 65.8]],
      status: "approximate-outline",
      evidence: "Outer extent follows the Metallurgy Lab side wing linework; CAD contains façade details and gaps not represented by this surface.",
    },
    {
      id: "west-upper-room-bar",
      points: [[34.1, 65.0], [81.6, 65.2], [81.6, 77.1], [34.1, 76.9]],
      status: "reviewed-outline",
      evidence: "Source has a long south boundary near Y 65.2, outer ends near X 34.1/81.6, and repeated partitions up to the paired north wall lines near Y 77.2.",
    },
    {
      id: "east-upper-room-bar",
      points: [[93.3, 65.2], [142.4, 65.4], [142.4, 77.9], [93.3, 77.1]],
      status: "reviewed-outline",
      evidence: "Source linework shows a separate east room bar with the central-court edge near Y 65.3 and repeated interior partitions.",
    },
    {
      id: "far-east-room-wing",
      points: [[148.9, 70.2], [195.5, 70.6], [195.5, 80.2], [148.4, 80.4]],
      status: "reviewed-outline",
      evidence: "Source shows a distinct far-east block beginning across the narrow connector; outline corners are approximate between façade details.",
    },
    {
      id: "west-pg-and-conference-wing",
      points: [[34.1, 32.5], [47.0, 32.8], [47.0, 65.4], [34.1, 65.3]],
      status: "approximate-outline",
      evidence: "Source labels P.G. Lab and Conference Hall in this narrow wing; detailed entries and facade openings are not represented as surfaces.",
    },
    {
      id: "east-electrical-wing",
      points: [[132.5, 33.0], [143.1, 33.0], [143.1, 65.8], [132.5, 65.8]],
      status: "approximate-outline",
      evidence: "Electrical/PE Lab source labels and long side-wing lines locate the zone; this surface is only an outline approximation.",
    },
    {
      id: "office-entrance-projection",
      points: [[80.6, 56.4], [96.8, 56.5], [96.7, 65.3], [80.6, 65.2]],
      status: "reviewed-outline",
      evidence: "The source linework forms a distinct central projection labeled Office Entrance; the stairs inside remain linework only.",
    },
  ],
  reviewedWallRuns: [
    // Repeated interior divisions in the west upper room bar. Each centerline
    // comes from a parallel pair in DXF; short end gaps are preserved.
    { id: "west-bar-partition-01", points: [[44.63, 67.75], [44.65, 76.90]], evidence: "Centerline of parallel source wall edges around X 44.42/44.80." },
    { id: "west-bar-partition-02", points: [[51.90, 67.78], [51.92, 76.93]], evidence: "Centerline of parallel source wall edges around X 51.71/52.08." },
    { id: "west-bar-partition-03", points: [[59.28, 67.81], [59.30, 76.97]], evidence: "Centerline of parallel source wall edges around X 59.09/59.46." },
    { id: "west-bar-partition-04", points: [[66.74, 67.85], [66.76, 77.00]], evidence: "Centerline of parallel source wall edges around X 66.55/66.92." },
    { id: "west-bar-partition-05", points: [[74.08, 67.89], [74.10, 74.64]], evidence: "Centerline of the source partition pair near X 73.90/74.26; trace stops at the visible end." },
    { id: "west-bar-east-end", points: [[81.41, 67.30], [81.43, 77.07]], evidence: "Centerline of parallel source wall edges around X 81.22/81.59." },
    { id: "west-bar-south-edge-a", points: [[50.36, 65.06], [80.58, 65.20]], evidence: "Continuous long source boundary segment along the open court edge; its source endpoints are preserved." },
    { id: "west-bar-south-edge-b", points: [[34.12, 65.15], [43.89, 65.19]], evidence: "Parallel source wall edges near Y 64.98/65.34 in the west conference connection." },
    { id: "west-upper-outer-edge", points: [[36.17, 77.17], [52.57, 77.24]], evidence: "Centerline of the paired source edges at Y 76.86 and 77.48; only the actual drawn segment is traced." },

    // East upper room bar and its repeated internal divisions.
    { id: "east-bar-west-end", points: [[93.35, 67.35], [93.37, 77.12]], evidence: "Long source boundary at the west end of the east upper wing." },
    { id: "east-bar-partition-01", points: [[101.31, 68.01], [101.36, 77.16]], evidence: "Centerline of the parallel source division near X 101.24/101.38." },
    { id: "east-bar-partition-02", points: [[112.52, 68.06], [112.52, 71.47]], evidence: "Centerline of source partition edges near X 112.33/112.71; trace stops at the drawn endpoint." },
    { id: "east-bar-partition-03", points: [[116.37, 68.08], [116.37, 77.23]], evidence: "Centerline of parallel source division near X 116.18/116.56." },
    { id: "east-bar-partition-04", points: [[127.38, 68.13], [127.38, 77.28]], evidence: "Centerline of parallel source division near X 127.17/127.59." },
    { id: "east-bar-partition-05", points: [[141.82, 68.20], [141.83, 73.55]], evidence: "Source partition reaches the drawn endpoint near X 141.81; the continuation is not inferred." },
    { id: "east-bar-inner-crosswall-a", points: [[127.56, 71.28], [134.49, 71.32]], evidence: "Centerline of repeated parallel horizontal CAD edges near Y 71.22/71.35." },
    { id: "east-bar-inner-crosswall-b", points: [[127.56, 74.76], [134.47, 74.77]], evidence: "Centerline of repeated parallel horizontal CAD edges near Y 74.70/74.83." },
    { id: "east-bar-inner-crosswall-c", points: [[134.48, 73.55], [141.81, 73.56]], evidence: "Centerline of parallel source wall edges near Y 73.41/73.67." },
    { id: "east-bar-south-edge-a", points: [[95.50, 65.27], [126.08, 65.42]], evidence: "Long source boundary segment facing the courtyard; its drawn break at either end is preserved." },
    { id: "east-bar-south-edge-b", points: [[132.54, 65.62], [142.32, 65.82]], evidence: "Centerline of paired source edges near Y 65.42/65.84." },

    // Distinct far-east room bar and the narrow source connector.
    { id: "far-east-south-edge", points: [[148.88, 70.20], [174.33, 70.32]], evidence: "Long source boundary segment forming the south side of the far-east bar." },
    { id: "far-east-east-end", points: [[195.49, 70.62], [195.46, 80.17]], evidence: "Source end-wall segment at the far-east edge." },
    { id: "far-east-partition-a", points: [[174.49, 72.64], [174.52, 80.49]], evidence: "Centerline of parallel source partition edges near X 174.28/174.65." },
    { id: "far-east-partition-b", points: [[170.72, 72.81], [170.73, 80.47]], evidence: "Centerline of parallel source partition edges near X 170.52/170.91." },

    // Central entrance and the two source-labeled side wings.
    { id: "entrance-west-wall-a", points: [[80.80, 57.62], [80.99, 65.02]], evidence: "Centerline of paired source edges along the west side of the entrance projection." },
    { id: "entrance-east-wall", points: [[96.78, 56.45], [96.74, 65.28]], evidence: "Source side wall at the east side of the labeled Office Entrance projection." },
    { id: "entrance-interior-partition", points: [[90.72, 58.04], [90.90, 64.88]], evidence: "Centerline of parallel source edges near X 90.53/90.90; endpoint gaps are preserved." },
    { id: "entrance-south-edge", points: [[80.62, 56.42], [96.78, 56.45]], evidence: "Source boundary at the south end of the entrance projection; no door or stair is inferred." },
    { id: "pg-conference-crosswall-a", points: [[34.17, 55.00], [41.84, 55.04]], evidence: "Centerline of parallel source edges at Y 54.82/55.19 between the source-labeled conference and lower wing area." },
    { id: "pg-lab-west-wall", points: [[34.15, 55.19], [34.17, 61.48]], evidence: "Visible source wall segment at the west edge of the labeled side-wing plan." },
    { id: "pg-lab-east-wall", points: [[43.94, 50.84], [43.96, 58.94]], evidence: "Visible source wall segment at the east side of the side wing; trace stops at its CAD endpoints." },
    { id: "electrical-wing-east-wall", points: [[142.67, 35.81], [142.72, 55.80]], evidence: "Centerline of the near-parallel source edge pair around X 142.36/142.98." },
  ].map((run) => ({ ...run, status: "reviewed" })),
  stairPlanTraces: [
    {
      id: "ground-conference-up-stair-plan",
      status: "reviewed-plan-linework",
      upLabel: [44.26, 62.458],
      evidence: "A nearby UP MTEXT label and repeated parallel CAD lines support this stair-plan interpretation. These exact tread-like segments are traced in plan only; no riser height or vertical connection is inferred.",
      treads: [
        [[40.320, 63.002], [40.327, 61.510]],
        [[40.619, 63.003], [40.626, 61.512]],
        [[40.917, 63.005], [40.924, 61.513]],
        [[41.216, 63.006], [41.223, 61.514]],
        [[41.514, 63.008], [41.521, 61.516]],
        [[41.812, 63.009], [41.819, 61.517]],
        [[42.111, 63.010], [42.118, 61.519]],
        [[42.409, 63.012], [42.416, 61.520]],
        [[42.707, 63.013], [42.714, 61.521]],
        [[43.006, 63.015], [43.013, 61.523]],
        [[43.304, 63.016], [43.311, 61.524]],
        [[43.603, 63.017], [43.610, 61.526]],
        [[43.901, 63.019], [43.908, 61.527]],
        [[43.908, 61.527], [45.996, 61.537]],
        [[43.909, 61.229], [45.998, 61.238]],
        [[43.911, 60.930], [45.999, 60.940]],
        [[43.912, 60.632], [46.001, 60.642]],
      ],
    },
    {
      id: "ground-east-up-stair-plan",
      status: "reviewed-plan-linework",
      upLabel: [145.073, 76.251],
      evidence: "A nearby UP MTEXT label and six repeated parallel CAD segments support this stair-plan interpretation. Vertical rise and connection are not represented.",
      treads: [
        [[142.431, 74.028], [148.399, 74.055]],
        [[142.430, 74.326], [148.397, 74.354]],
        [[142.429, 74.624], [148.396, 74.652]],
        [[142.427, 74.923], [148.395, 74.951]],
        [[142.426, 75.221], [148.393, 75.249]],
        [[142.424, 75.519], [148.392, 75.547]],
      ],
    },
  ],
  roomBoundaries: [],
  openings: [],
  stairs: [],
  unverifiedFeatureCandidates: [
    { feature: "doors and openings", status: "unverified", rendered: false, evidence: "Line gaps and short marks are present, but the inspected DXF provides no reliably classified door entities or swing symbols." },
    { feature: "windows", status: "unverified", rendered: false, evidence: "Repeated facade details are visible, but active entities share an ambiguous layer; their function is not established by layer or block data." },
    { feature: "corridor boundaries", status: "unverified", rendered: false, evidence: "No separate corridor layer or clear corridor boundary entities were isolated; circulation space remains open in the model." },
    { feature: "stair elevation and connections", status: "unverified", rendered: false, evidence: "Plan tread patterns and UP labels locate stair-like features, but riser heights, landings in elevation, and floor-to-floor connections are unavailable." },
  ],
  limitations: [
    "Reviewed means visually checked against the source linework, not construction-verified; active entities share the ambiguous window layer.",
    "Wall heights and thicknesses are visualization values.",
    "Room labels remain source annotations at their DXF coordinates and are not assigned to the traced regions.",
    "Stair traces reproduce supported tread-like plan segments only; no vertical stair geometry is reconstructed. Doors and windows remain unclassified, and line breaks are not bridged.",
  ],
};
