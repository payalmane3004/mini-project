import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import CampusFootprints from "./CampusFootprints";
import CampusSiteLines from "./CampusSiteLines";
import CampusLabels from "./CampusLabels";
import footprintData from "../../data/wce-campus-footprints.json";
import { CAMPUS_TARGET_WIDTH, campusCadBounds, campusCadScale, normalizeCadPoint } from "./cadCoordinates";

const overviewTarget = new THREE.Vector3(0, 0, 0);
const overviewDistance = Math.hypot(76, 64, 76);

function CampusGround() {
  const geometry = useMemo(() => {
    const width = CAMPUS_TARGET_WIDTH;
    const depth = (campusCadBounds.maxY - campusCadBounds.minY) * campusCadScale;
    return new THREE.PlaneGeometry(width + 5, depth + 5);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group rotation={[-Math.PI / 2, 0, 0]}>
    <mesh geometry={geometry} position={[0, 0, -0.04]} rotation={[0, 0, 0]} raycast={() => null}>
      <meshStandardMaterial color="#182c35" roughness={1} metalness={0} />
    </mesh>
  </group>;
}

function CampusCameraFocus({ selectedId }) {
  const controlsRef = useRef(null);
  const transitionRef = useRef(null);
  const { camera } = useThree();
  const footprintMap = useMemo(() => new Map(footprintData.footprints.map((footprint) => [footprint.id, footprint])), []);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const footprint = selectedId ? footprintMap.get(selectedId) : null;
    let target = overviewTarget.clone();
    let distance = overviewDistance;
    if (footprint) {
      const xs = footprint.polygon.map(([x]) => x);
      const ys = footprint.polygon.map(([, y]) => y);
      const [centerX, centerNorth] = normalizeCadPoint((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
      target = new THREE.Vector3(centerX, 0, -centerNorth);
      distance = 26;
    }
    const direction = camera.position.clone().sub(controls.target).normalize();
    transitionRef.current = { target, direction, distance };
  }, [camera, footprintMap, selectedId]);

  useFrame((_, delta) => {
    const transition = transitionRef.current;
    const controls = controlsRef.current;
    if (!transition || !controls) return;
    const alpha = 1 - Math.exp(-4.5 * delta);
    controls.target.lerp(transition.target, alpha);
    const desiredPosition = transition.target.clone().addScaledVector(transition.direction, transition.distance);
    camera.position.lerp(desiredPosition, alpha);
    controls.update();
    if (controls.target.distanceTo(transition.target) < 0.025 && camera.position.distanceTo(desiredPosition) < 0.05) {
      controls.target.copy(transition.target);
      camera.position.copy(desiredPosition);
      transitionRef.current = null;
      controls.update();
    }
  });

  return <OrbitControls
    ref={controlsRef}
    makeDefault
    enableRotate
    enablePan
    enableZoom
    minDistance={12}
    maxDistance={overviewDistance * 1.45}
    minPolarAngle={0.12}
    maxPolarAngle={Math.PI / 2.05}
    dampingFactor={0.08}
    enableDamping
  />;
}

function CampusScene({ selectedId, onSelectBuilding }) {

  return (
    <div className="campus-3d-scene">
      <Canvas
        shadows="basic"
        dpr={[1, 1.5]}
        onPointerMissed={() => onSelectBuilding?.(null)}
      >
        <PerspectiveCamera
          makeDefault
          position={[76, 64, 76]}
          fov={38}
          near={0.1}
          far={400}
        />
        <color attach="background" args={["#0B1220"]} />
        <ambientLight intensity={1.5} />
        <directionalLight
          position={[35, 70, 25]}
          intensity={2.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <Suspense fallback={null}>
          <CampusGround />
          <CampusFootprints
            selectedId={selectedId}
            onSelectBuilding={onSelectBuilding}
          />
          <CampusSiteLines />
          <CampusLabels />
        </Suspense>

        <CampusCameraFocus selectedId={selectedId} />
      </Canvas>
    </div>
  );
}

export default CampusScene;
