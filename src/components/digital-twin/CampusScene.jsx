import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  OrthographicCamera,
} from "@react-three/drei";

import CampusFootprints from "./CampusFootprints";
import CampusSiteLines from "./CampusSiteLines";
import CampusLabels from "./CampusLabels";

function CampusScene({
  selectedId,
  onSelectBuilding,
}) {
  return (
    <div className="campus-3d-scene">
      <Canvas>
        <OrthographicCamera
          makeDefault
          position={[0, 50, 0]}
          left={-40}
          right={40}
          top={30}
          bottom={-30}
          near={0.1}
          far={200}
        />

        <CampusFootprints
          selectedId={selectedId}
          onSelectBuilding={onSelectBuilding}
        />

        <CampusSiteLines />

        <CampusLabels />

        <OrbitControls
          enableRotate={false}
          enablePan={false}
          enableZoom={false}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}

export default CampusScene;
