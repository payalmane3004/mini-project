import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import { Suspense } from "react";

import CampusFootprints from "./CampusFootprints";
import CampusSiteLines from "./CampusSiteLines";
import CampusLabels from "./CampusLabels";

function CampusScene({ selectedId, onSelectBuilding }) {
  return (
    <div className="campus-3d-scene">
      <Canvas shadows="basic" dpr={[1, 1.5]}>
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
          <CampusFootprints
            selectedId={selectedId}
            onSelectBuilding={onSelectBuilding}
          />
          <CampusSiteLines />
          <CampusLabels />
        </Suspense>

        <OrbitControls
          makeDefault
          enableRotate
          enablePan
          enableZoom
          minDistance={35}
          maxDistance={180}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 0, 0]}
          dampingFactor={0.08}
          enableDamping
        />
      </Canvas>
    </div>
  );
}

export default CampusScene;
