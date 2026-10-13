import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { ArrowLeft, Box, DoorOpen, Info } from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import * as THREE from "three";

import footprintData from "../../data/wce-campus-footprints.json";
import labelData from "../../data/wce-building-labels.json";
import { buildingDrawings, originalBuildingDrawings, processedBuildingPlans } from "../../data/buildingDrawings";
import MainBuildingInteriorPrototype from "./MainBuildingInteriorPrototype";
import SourceBuildingPlan from "../../components/digital-twin/SourceBuildingPlan";
import "./BuildingExplorer.css";

const illustrativeHeight = 1.8;

function BuildingShell({ footprint, buildingName }) {
  const model = useMemo(() => {
    const xs = footprint.polygon.map(([x]) => x);
    const ys = footprint.polygon.map(([, y]) => y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const shape = new THREE.Shape();
    const scale = 30 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    footprint.polygon.forEach(([x, y], index) => {
      const px = (x - centerX) * scale;
      const py = (y - centerY) * scale;
      if (index === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    });
    shape.closePath();
    footprint.holes?.forEach((points) => {
      const hole = new THREE.Path();
      points.forEach(([x, y], index) => index === 0 ? hole.moveTo((x - centerX) * scale, (y - centerY) * scale) : hole.lineTo((x - centerX) * scale, (y - centerY) * scale));
      hole.closePath();
      shape.holes.push(hole);
    });
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: illustrativeHeight, bevelEnabled: false, curveSegments: 1 });
    const edges = new THREE.EdgesGeometry(geometry, 1);
    return { geometry, edges, width: (Math.max(...xs) - Math.min(...xs)) * scale, depth: (Math.max(...ys) - Math.min(...ys)) * scale };
  }, [footprint]);
  useEffect(() => () => { model.geometry.dispose(); model.edges.dispose(); }, [model]);
  const distance = Math.max(model.width, model.depth) * 1.7;
  return (
    <>
      <color attach="background" args={["#101923"]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[-12, 18, 14]} intensity={2.1} />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={model.geometry} castShadow receiveShadow>
          <meshStandardMaterial color="#536c7a" roughness={0.78} />
        </mesh>
        <lineSegments geometry={model.edges}>
          <lineBasicMaterial color="#b6d2dc" />
        </lineSegments>
      </group>
      <Html position={[0, illustrativeHeight + 0.12, 0]} center pointerEvents="none" zIndexRange={[20, 0]}>
        <span className="building-explorer-model-label">{buildingName}</span>
      </Html>
      <gridHelper args={[Math.max(model.width, model.depth) * 1.4, 24, "#31495a", "#233644"]} position={[0, -0.04, 0]} />
      <PerspectiveCamera makeDefault position={[distance, distance * 0.92, distance]} fov={40} near={0.1} far={5000} />
      <OrbitControls makeDefault target={[0, illustrativeHeight / 2, 0]} enableDamping dampingFactor={0.08} minDistance={Math.max(model.width, model.depth) * 0.25} maxDistance={distance * 3} />
    </>
  );
}

export default function BuildingExplorer() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { buildingId } = useParams();
  const footprint = footprintData.footprints.find((item) => item.id === buildingId);
  const labels = labelData.buildings.find((item) => item.footprintId === buildingId)?.labels ?? [];
  const mainBuildingDrawing = buildingDrawings[buildingId];
  const drawing = mainBuildingDrawing ?? processedBuildingPlans[buildingId];
  const sourceDrawing = originalBuildingDrawings[buildingId];
  const name = drawing?.buildingName ?? (labels.length ? labels.join(" / ") : buildingId);
  const returnTo = location.state?.returnTo ?? `/digital-twin?building=${encodeURIComponent(buildingId)}`;
  const [viewSelection, setViewSelection] = useState(null);
  const hasLinkedAnnotation = searchParams.has("annotation") || searchParams.has("floor");
  const view = viewSelection?.buildingId === buildingId ? viewSelection.view : drawing && hasLinkedAnnotation ? "interior" : "exterior";
  const setView = (nextView) => setViewSelection({ buildingId, view: nextView });

  if (!footprint) return <main className="building-explorer-page"><p>Campus building {buildingId} was not found.</p><Link to="/digital-twin">Return to campus</Link></main>;

  return (
    <main className="building-explorer-page">
      <header className="building-explorer-header">
        <div>
          <Link to={returnTo} className="building-explorer-back"><ArrowLeft size={15} /> {returnTo.startsWith("/digital-twin") ? "Return to Campus Twin" : "Return to building directory"}</Link>
          <div className="building-explorer-kicker">BUILDING EXPLORATION · {buildingId}</div>
          <h1>{name}</h1>
          <p>{mainBuildingDrawing ? "Opening the reviewed Main Building floor explorer." : drawing ? "Opening the converted source drawing. Floor grouping and room associations are shown only where verified." : sourceDrawing ? `Original ${sourceDrawing.originalFilename} is associated by CAD label but is not converted for in-app viewing. The exterior below is the campus footprint only.` : "No confidently associated building-specific plan is available. The exterior below is the campus footprint only."}</p>
        </div>
        <div className="building-explorer-tabs" role="tablist" aria-label="Building view">
          <button role="tab" aria-selected={view === "exterior"} className={view === "exterior" ? "active" : ""} onClick={() => setView("exterior")}><Box size={15} /> Exterior</button>
          <button role="tab" aria-selected={view === "interior"} className={view === "interior" ? "active" : ""} onClick={() => setView("interior")} disabled={!drawing} title={drawing ? "Open source-linked building plan" : "No supported interior drawing is linked to this campus footprint."}><DoorOpen size={15} />{mainBuildingDrawing ? "Interior · 2 floors" : drawing ? "Source plan & labels" : "Interior · unavailable"}</button>
        </div>
      </header>

      {view === "exterior" ? (
        <section className="building-explorer-model">
          <div className="building-explorer-model-heading"><strong>{name} · existing campus CAD footprint</strong><span>Orbit · zoom · pan</span></div>
          <Canvas shadows dpr={[1, 1.5]}><BuildingShell footprint={footprint} buildingName={name} /></Canvas>
          <div className="building-explorer-note"><Info size={15} /><span>This view extrudes the selected existing campus footprint for inspection. It does not represent surveyed building height or architectural detail.</span></div>
        </section>
      ) : mainBuildingDrawing ? (
        <section className="building-explorer-interior">
          <MainBuildingInteriorPrototype embedded />
        </section>
      ) : drawing ? <SourceBuildingPlan key={buildingId} drawing={drawing} buildingId={buildingId} /> : null}
      {!drawing && sourceDrawing && <a className="building-source-download" href={sourceDrawing.sourceUrl} download>Download original drawing: {sourceDrawing.originalFilename}</a>}
    </main>
  );
}
