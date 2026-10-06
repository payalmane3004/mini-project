import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

function MapReference() {
  const texture = useLoader(
    THREE.TextureLoader,
    "/maps/wce-campus-map.png"
  );

  texture.colorSpace = THREE.SRGBColorSpace;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <planeGeometry args={[30, 40]} />

      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default MapReference;