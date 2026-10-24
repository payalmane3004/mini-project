import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

function MapReference() {
  const texture = useLoader(
    THREE.TextureLoader,
    "/maps/wce-campus-map.png"
  );
  const colorManagedTexture = useMemo(() => {
    const clone = texture.clone();
    clone.colorSpace = THREE.SRGBColorSpace;
    return clone;
  }, [texture]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <planeGeometry args={[30, 40]} />

      <meshBasicMaterial
        map={colorManagedTexture}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default MapReference;
