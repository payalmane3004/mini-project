import { Canvas, useLoader } from "@react-three/fiber";
import { Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { ArrowLeft, AlertTriangle, Eye, EyeOff, RotateCcw, Cuboid } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { mainBuildingGroundFloorTrace as trace } from "../../data/mainBuildingGroundFloorTrace";
import { mainBuildingGroundFloorArchitecture as architecture } from "../../data/mainBuildingGroundFloorArchitecture";
import { mainBuildingFirstFloorArchitecture } from "../../data/mainBuildingFirstFloorArchitecture";
import facilityDirectory from "../../data/main-building-facilities.json";
import groundFloorSource from "../../data/main-building-ground-floor-labels.json";
import firstFloorSource from "../../data/main-building-first-floor-labels.json";
import "./MainBuildingInteriorPrototype.css";

const modelScale = trace.visualization.scale;
const floorSources = {
  "Ground Floor": { ...groundFloorSource, annotations: facilityDirectory.annotations.filter((item) => item.floor === "Ground Floor"), architecture, previewUrl: "/campus-maps/processed/main-building-ground-floor-underlay.svg", hasTracedGeometry: true, hasUnverifiedCandidates: true },
  "First Floor": { ...firstFloorSource, annotations: facilityDirectory.annotations.filter((item) => item.floor === "First Floor"), architecture: mainBuildingFirstFloorArchitecture, previewUrl: "/campus-maps/processed/main-building-first-floor-underlay.svg", hasTracedGeometry: true, hasUnverifiedCandidates: false },
};

function getFloorMetrics(source) {
  const [minX, maxX] = source.bounds.xRange;
  const [minY, maxY] = source.bounds.yRange;
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: (maxX - minX) * modelScale,
    depth: (maxY - minY) * modelScale,
  };
}

function cadToWorld([x, y], source = groundFloorSource) {
  const { centerX, centerY } = getFloorMetrics(source);
  return [(x - centerX) * modelScale, -(y - centerY) * modelScale];
}

function SourceUnderlay({ source }) {
  const loadedTexture = useLoader(THREE.TextureLoader, source.previewUrl);
  const texture = useMemo(() => {
    const copy = loadedTexture.clone();
    copy.colorSpace = THREE.SRGBColorSpace;
    copy.anisotropy = 8;
    return copy;
  }, [loadedTexture]);
  useEffect(() => () => texture.dispose(), [texture]);
  const { width, depth } = getFloorMetrics(source);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.096, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial map={texture} transparent opacity={0.94} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function TracedFootprint({ source }) {
  const { centerX, centerY } = getFloorMetrics(source);
  const floorArchitecture = source.architecture;
  const geometries = useMemo(() => floorArchitecture.floorZones.map((zone) => {
    const shape = new THREE.Shape();
    zone.points.forEach(([x, y], index) => {
      const localX = (x - centerX) * modelScale;
      const localNorth = (y - centerY) * modelScale;
      if (index === 0) shape.moveTo(localX, localNorth);
      else shape.lineTo(localX, localNorth);
    });
    shape.closePath();
    return { id: zone.id, geometry: new THREE.ExtrudeGeometry(shape, {
      depth: floorArchitecture.visualization.floorThickness,
      bevelEnabled: false,
    }), status: zone.status };
  }), [centerX, centerY, floorArchitecture]);

  return geometries.map(({ id, geometry, status }) => (
    <mesh
      key={id}
      geometry={geometry}
      position={[0, -0.11 - floorArchitecture.visualization.floorThickness, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      castShadow
    >
      <meshStandardMaterial color={status === "reviewed-outline" ? "#a8b8be" : "#7d929b"} roughness={0.88} metalness={0.01} />
    </mesh>
  ));
}

function TracedWalls({ runs, color, source }) {
  const { wallHeight, wallThickness } = source.architecture.visualization;
  return runs.map((run) => run.points.slice(1).map((point, index) => {
    const start = run.points[index];
    const [x1, z1] = cadToWorld(start, source);
    const [x2, z2] = cadToWorld(point, source);
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.025) return null;
    return (
      <mesh
        key={`${run.id}-${index}`}
        position={[(x1 + x2) / 2, wallHeight / 2 - 0.11, (z1 + z2) / 2]}
        rotation={[0, -Math.atan2(dz, dx), 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, wallHeight, wallThickness]} />
        <meshStandardMaterial
          color={color}
          transparent={color === "#f3a94c"}
          opacity={color === "#f3a94c" ? 0.78 : 1}
          roughness={0.76}
          metalness={0.04}
        />
      </mesh>
    );
  }));
}

function StairLabelCues({ source }) {
  const planTraces = source.architecture.stairPlanTraces ?? [];
  const upLabels = source.annotations.filter((annotation) => annotation.originalCadText.trim().toUpperCase() === "UP");
  return <>
    {planTraces.flatMap((trace) => trace.treads.map((tread, index) => {
      const [x1, z1] = cadToWorld(tread[0], source);
      const [x2, z2] = cadToWorld(tread[1], source);
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      if (length < 0.025) return null;
      return (
        <mesh
          key={`${trace.id}-tread-${index}`}
          position={[(x1 + x2) / 2, -0.073, (z1 + z2) / 2]}
          rotation={[0, -Math.atan2(dz, dx), 0]}
        >
          <boxGeometry args={[length, 0.012, 0.018]} />
          <meshBasicMaterial color="#bd9860" />
        </mesh>
      );
    }))}
    {upLabels.map((label) => {
      const [x, z] = cadToWorld([label.dxfX, label.dxfY], source);
      return (
        <Html key={label.id} position={[x, -0.035, z]} center distanceFactor={10} pointerEvents="none">
          <span className="interior-cad-cue" title="UP is source text; tread traces are plan-only and stair elevation is unknown">UP · plan trace</span>
        </Html>
      );
    })}
  </>;
}

function SourceLabelAnnotations({ source, selectedAnnotation, onSelectAnnotation }) {
  return source.annotations.map((annotation) => {
    const [x, z] = cadToWorld([annotation.dxfX, annotation.dxfY], source);
    const key = annotation.id;
    // The invisible hit plane is larger than the fixed-size screen label.
    // Text itself has pointer-events disabled, so drag gestures still reach OrbitControls.
    const hitWidth = Math.max(0.52, annotation.originalCadText.length * modelScale * 1.8);
    const isSelected = selectedAnnotation === annotation;
    return (
      <group key={key}>
        <mesh
          position={[x + hitWidth / 2, -0.062, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(event) => { event.stopPropagation(); onSelectAnnotation(annotation); }}
          onPointerOver={(event) => { event.stopPropagation(); event.nativeEvent.target.style.cursor = "pointer"; }}
          onPointerOut={(event) => { event.nativeEvent.target.style.cursor = ""; }}
        >
          <planeGeometry args={[hitWidth, 0.38]} />
          <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <Html position={[x, -0.045, z]} center={false} pointerEvents="none" zIndexRange={[30, 0]}>
          <span className={`interior-floor-label${isSelected ? " selected" : ""}`} title="Source annotation insertion point; room association not verified">
            {annotation.originalCadText}
          </span>
        </Html>
      </group>
    );
  });
}

function InteriorScene({ source, showUnderlay, showTrace, showReviewedWalls, showCues, showSourceLabels, cameraView, selectedAnnotation, onSelectAnnotation }) {
  const { width, depth } = getFloorMetrics(source);
  const cameraDistance = Math.max(width, depth) * 1.7;
  const selectedPosition = selectedAnnotation ? cadToWorld([selectedAnnotation.dxfX, selectedAnnotation.dxfY], source) : null;
  return (
    <>
      <color attach="background" args={["#0c141d"]} />
      <fog attach="fog" args={["#0c141d", 38, 92]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[-8, 18, 12]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <hemisphereLight args={["#dbeafe", "#64748b", 0.72]} />

      {source.hasTracedGeometry && <TracedFootprint source={source} />}
      {showUnderlay && <Suspense fallback={null}><SourceUnderlay source={source} /></Suspense>}
      {showReviewedWalls && source.hasTracedGeometry && <TracedWalls runs={source.architecture.reviewedWallRuns} color="#9bd3e5" source={source} />}
      {showTrace && source.hasUnverifiedCandidates && <TracedWalls runs={trace.wallRuns} color="#f3a94c" source={source} />}
      {showSourceLabels && <SourceLabelAnnotations source={source} selectedAnnotation={selectedAnnotation} onSelectAnnotation={onSelectAnnotation} />}
      {showCues && <StairLabelCues source={source} />}
      {selectedPosition && (
        <group position={[selectedPosition[0], -0.058, selectedPosition[1]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.55, 36]} />
            <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
            <circleGeometry args={[0.16, 24]} />
            <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} />
          </mesh>
          <Html position={[0.62, 0.025, 0]} center={false} pointerEvents="none" zIndexRange={[40, 0]}>
            <span className="interior-selection-marker-label">Source label: {selectedAnnotation.originalCadText}</span>
          </Html>
        </group>
      )}
      <gridHelper args={[width + 18, 40, "#2d4657", "#1d303e"]} position={[0, -0.31, 0]} />
      <PerspectiveCamera
        makeDefault
        position={cameraView === "top" ? [0, cameraDistance, 0.001] : [cameraDistance * 0.45, cameraDistance * 0.46, cameraDistance * 0.58]}
        up={cameraView === "top" ? [0, 0, -1] : [0, 1, 0]}
        fov={38}
        near={0.1}
        far={180}
      />
      <OrbitControls
        makeDefault
        target={[0, 1.2, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={cameraDistance * 2.5}
        maxPolarAngle={Math.PI * 0.49}
      />
    </>
  );
}

function LayerToggle({ active, onClick, children, disabled = false }) {
  const Icon = active ? Eye : EyeOff;
  return <button className={`interior-layer-toggle${active ? " active" : ""}`} onClick={onClick} disabled={disabled}><Icon size={15} />{children}<span>{disabled ? "N/A" : active ? "On" : "Off"}</span></button>;
}

export default function MainBuildingInteriorPrototype({ embedded = false }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const returnTo = location.state?.returnTo ?? "/digital-twin?building=BU-002";
  const linkedFacility = facilityDirectory.annotations.find((annotation) => annotation.id === searchParams.get("facility")) ?? null;
  const [activeFloor, setActiveFloor] = useState(() => linkedFacility?.floor ?? "Ground Floor");
  const [selectedAnnotation, setSelectedAnnotation] = useState(() => linkedFacility);
  const [facilityQuery, setFacilityQuery] = useState("");
  const [facilityFloorFilter, setFacilityFloorFilter] = useState("All Floors");
  const [showUnderlay, setShowUnderlay] = useState(true);
  const [showTrace, setShowTrace] = useState(false);
  const [showReviewedWalls, setShowReviewedWalls] = useState(true);
  const [showCues, setShowCues] = useState(true);
  const [showSourceLabels, setShowSourceLabels] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [compareMode, setCompareMode] = useState(true);
  const [cameraView, setCameraView] = useState("top");
  const source = floorSources[activeFloor];
  const metrics = getFloorMetrics(source);
  const normalizedQuery = facilityQuery.trim().toLocaleLowerCase();
  const matchingFacilities = facilityDirectory.annotations.filter((annotation) =>
    (facilityFloorFilter === "All Floors" || annotation.floor === facilityFloorFilter)
    && annotation.originalCadText.toLocaleLowerCase().includes(normalizedQuery));
  const resetView = () => {
    setCameraView("top");
    setResetKey((value) => value + 1);
  };
  const selectFacility = (annotation) => {
    setActiveFloor(annotation.floor);
    setCameraView("top");
    setSelectedAnnotation(annotation);
    setResetKey((value) => value + 1);
    const next = new URLSearchParams(searchParams);
    next.set("facility", annotation.id);
    setSearchParams(next, { replace: true });
  };
  const clearFacilitySelection = () => {
    setSelectedAnnotation(null);
    const next = new URLSearchParams(searchParams);
    next.delete("facility");
    setSearchParams(next, { replace: true });
    resetView();
  };
  return (
    <div className={`interior-prototype-page${embedded ? " embedded" : ""}`}>
      {!embedded && <div className="interior-prototype-header">
        <div>
          <div className="interior-prototype-kicker"><Cuboid size={14} /> INTERIOR STUDY · PHASE 3</div>
          <h1>Main Building · Interior Study</h1>
          <p>{embedded ? "Building exploration · source-linked prototype" : "Independent 3D tracing prototype · development route"}</p>
        </div>
        <div className="interior-prototype-actions">
          <Link to={returnTo} className="interior-back-link"><ArrowLeft size={15} /> {returnTo.startsWith("/digital-twin") ? "Campus Twin" : "Building directory"}</Link>
          <button onClick={resetView}><RotateCcw size={15} /> Reset view</button>
        </div>
      </div>}

      <div className="interior-prototype-layout">
        <section className="interior-canvas-card">
          <div className="interior-canvas-toolbar">
            <div className="interior-floor-select" role="group" aria-label="Choose source floor">
              {Object.keys(floorSources).map((floor) => <button key={floor} className={activeFloor === floor ? "active" : ""} onClick={() => { setActiveFloor(floor); setSelectedAnnotation(null); setResetKey((value) => value + 1); }}>{floor}</button>)}
            </div>
            <div className="interior-compare-actions">
              <button onClick={() => setCompareMode((value) => !value)}>{compareMode ? "3D only" : "Compare 2D / 3D"}</button>
              <button onClick={() => { setCameraView((value) => value === "top" ? "iso" : "top"); setResetKey((value) => value + 1); }}>{cameraView === "top" ? "Perspective" : "Top-down"}</button>
              {embedded && <button onClick={resetView}><RotateCcw size={13} /> Reset view</button>}
              <span>Orbit · zoom · pan</span>
            </div>
          </div>
          <div className={`interior-canvas-stage${compareMode ? " compare-mode" : ""}`} key={resetKey}>
            {compareMode && (
              <figure className="interior-reference-pane">
                <figcaption>2D · original {activeFloor} CAD linework</figcaption>
                <div className="interior-reference-image-frame">
                  <img src={source.previewUrl} alt={`Original Main Building ${activeFloor} CAD linework`} />
                </div>
              </figure>
            )}
            <div className="interior-model-pane">
              <div className="interior-model-label">3D · same {activeFloor} CAD bounds and orientation</div>
              <Canvas shadows dpr={[1, 1.5]}>
                <InteriorScene source={source} showUnderlay={showUnderlay} showTrace={showTrace} showReviewedWalls={showReviewedWalls} showCues={showCues} showSourceLabels={showSourceLabels} cameraView={cameraView} selectedAnnotation={selectedAnnotation} onSelectAnnotation={setSelectedAnnotation} />
              </Canvas>
            </div>
          <div className="interior-canvas-caption">{source.hasTracedGeometry ? "CAD reference · approximate floor zones · reviewed wall runs · scale is illustrative" : "CAD reference plane only · architectural 3D trace not prepared"}</div>
          </div>
        </section>

        <aside className="interior-inspector">
          <div className="interior-warning"><AlertTriangle size={17} /><div><strong>{source.hasTracedGeometry ? "Assisted architectural trace" : "Source plan · not traced in 3D"}</strong><p>{source.hasTracedGeometry ? `Blue runs are visually reviewed against ${activeFloor} source linework, but the DXF layer is ambiguous and wall construction is not independently verified. ${source.hasUnverifiedCandidates ? "Amber candidates remain unverified and hidden initially. " : "No separate unverified wall candidates are registered for this floor. "}Floor zones are approximate; room polygons and door/window classifications are unresolved. Stair marks show plan tread linework only; their rise and floor connection are unknown.` : "This floor is shown as its original CAD reference only. Architectural walls, rooms, openings, and stairs have not been reconstructed."}</p></div></div>
          <section className="interior-inspector-section">
            <h2>Facility search ({matchingFacilities.length} of {facilityDirectory.annotations.length})</h2>
            <p className="interior-muted-note">Search literal CAD annotations. Selecting one changes to its floor and marks its text insertion point; the point is not a verified room center.</p>
            <label className="interior-facility-search-label" htmlFor="main-building-facility-search">Search facility or room label</label>
            <input id="main-building-facility-search" className="interior-facility-search" type="search" value={facilityQuery} onChange={(event) => setFacilityQuery(event.target.value)} placeholder="e.g. Chemistry Lab" />
            <label className="interior-facility-search-label" htmlFor="main-building-floor-filter">Filter results by floor</label>
            <select id="main-building-floor-filter" className="interior-facility-floor-filter" value={facilityFloorFilter} onChange={(event) => setFacilityFloorFilter(event.target.value)}>
              <option>All Floors</option>
              <option>Ground Floor</option>
              <option>First Floor</option>
            </select>
            <div className="interior-source-label-list" aria-label="Facility search results">
              {matchingFacilities.map((annotation) => <button key={annotation.id} className={selectedAnnotation === annotation ? "selected" : ""} onClick={() => selectFacility(annotation)}><span>{annotation.originalCadText}<small>{annotation.floor} · {annotation.id}</small></span><small>Source label</small></button>)}
              {matchingFacilities.length === 0 && <p className="interior-no-facility-results">No source annotations match this search.</p>}
            </div>
            {selectedAnnotation && <div className="interior-label-detail"><strong>{selectedAnnotation.originalCadText}</strong><span>Main Building · {selectedAnnotation.floor}</span><span>Source annotation location · not a verified room center</span><span>Verification: {selectedAnnotation.verificationStatus}; room association {selectedAnnotation.roomAssociationStatus}</span><span>DXF: X {selectedAnnotation.dxfX.toFixed(4)}, Y {selectedAnnotation.dxfY.toFixed(4)}</span><span>Drawing: {selectedAnnotation.sourceDrawing}</span><button className="interior-clear-selection" onClick={clearFacilitySelection}>Clear selection · show full floor</button></div>}
          </section>
          <section className="interior-inspector-section">
            <h2>Visible layers</h2>
            <LayerToggle active={showUnderlay} onClick={() => setShowUnderlay((value) => !value)}>Original CAD underlay</LayerToggle>
            <LayerToggle active={showReviewedWalls && source.hasTracedGeometry} disabled={!source.hasTracedGeometry} onClick={() => setShowReviewedWalls((value) => !value)}>Reviewed CAD wall trace</LayerToggle>
            <LayerToggle active={showTrace && source.hasUnverifiedCandidates} disabled={!source.hasUnverifiedCandidates} onClick={() => setShowTrace((value) => !value)}>Unverified original candidates</LayerToggle>
            <LayerToggle active={showSourceLabels} onClick={() => setShowSourceLabels((value) => !value)}>Source CAD labels</LayerToggle>
            <LayerToggle active={showCues} onClick={() => setShowCues((value) => !value)}>Stair plan traces + CAD “UP” labels</LayerToggle>
            <div className="interior-wall-legend"><span className="candidate-swatch" /> Unreviewed trace <span className="reviewed-swatch" /> Reviewed trace</div>
          </section>
          <section className="interior-inspector-section">
            <h2>Visualization values</h2>
            <div className="interior-meta-row"><span>Wall height</span><strong>{source.architecture.visualization.wallHeight.toFixed(1)} units</strong></div>
            <div className="interior-meta-row"><span>Wall thickness</span><strong>{source.architecture.visualization.wallThickness.toFixed(2)} units</strong></div>
            <div className="interior-meta-row"><span>CAD unit declaration</span><strong>Inches · unvalidated</strong></div>
            <p className="interior-muted-note">Height, thickness, and uniform drawing scale are configurable display values, not surveyed measurements.</p>
          </section>
          <section className="interior-inspector-section">
            <h2>Trace inventory</h2>
            <div className="interior-meta-row"><span>Source annotations on floor</span><strong>{source.annotations.length}</strong></div>
            <div className="interior-meta-row"><span>Visually reviewed wall runs</span><strong>{source.hasTracedGeometry ? source.architecture.reviewedWallRuns.length : "Not traced"}</strong></div>
            <div className="interior-meta-row"><span>Unverified candidates</span><strong>{source.hasUnverifiedCandidates ? trace.wallRuns.length : 0}</strong></div>
            <div className="interior-meta-row"><span>Manually verified room boundaries</span><strong>0</strong></div>
            <div className="interior-meta-row"><span>Approximate floor zones</span><strong>{source.hasTracedGeometry ? source.architecture.floorZones.length : "Not traced"}</strong></div>
            <div className="interior-meta-row"><span>Verified door openings</span><strong>0</strong></div>
            <div className="interior-meta-row"><span>Stair geometry</span><strong>Plan treads only</strong></div>
            <p className="interior-muted-note">{activeFloor} bounds: {metrics.width.toFixed(1)} × {metrics.depth.toFixed(1)} illustrative local units. Annotation coordinates use this floor's own DXF bounds.</p>
            <div className="interior-verification-key" aria-label="Geometry verification status">
              <p><strong>Source annotation</strong><span>Text insertion point; room association unverified.</span></p>
              <p><strong>Approximate floor zone</strong><span>Broad plan surface, not a room boundary.</span></p>
              <p><strong>Visually reviewed wall run</strong><span>Checked against CAD linework; wall role not independently verified.</span></p>
              <p><strong>Manually verified room boundary</strong><span>None recorded for this floor.</span></p>
            </div>
            {source.hasTracedGeometry ? <><p className="interior-muted-note">Reviewed architectural runs and approximate floor zones are editable in <code>{activeFloor === "Ground Floor" ? "src/data/mainBuildingGroundFloorArchitecture.js" : "src/data/mainBuildingFirstFloorArchitecture.js"}</code>. {source.hasUnverifiedCandidates && <>The original eight candidates remain separately editable in <code>src/data/mainBuildingGroundFloorTrace.js</code>.</>}</p><p className="interior-muted-note">Zones indicate major plan areas around the open court; room boundaries and facade openings remain unresolved. Labels retain their own CAD positions and are not mapped to these zones.</p></> : <p className="interior-muted-note">Source linework and text are shown as a reference. No architectural geometry has been traced for this floor.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
