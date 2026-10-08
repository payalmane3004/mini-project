import { useEffect, useMemo } from "react";
import * as THREE from "three";

import siteData from "../../data/wce-campus-site-lines.json";
import { normalizeCadPoint } from "./cadCoordinates";

function CampusSiteLines() {
  const geometry = useMemo(() => {
    const positions = [];

    for (const entity of siteData.entities) {
      const pts = entity.points;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const [x1, y1] = normalizeCadPoint(...pts[i]);
        const [x2, y2] = normalizeCadPoint(...pts[i + 1]);
        positions.push(x1, y1, 0, x2, y2, 0);
      }

      if (entity.closed && pts.length > 2) {
        const [x1, y1] = normalizeCadPoint(...pts[pts.length - 1]);
        const [x2, y2] = normalizeCadPoint(...pts[0]);
        positions.push(x1, y1, 0, x2, y2, 0);
      }
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    return buffer;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <lineSegments geometry={geometry} position={[0, 0, -0.015]} raycast={() => null}>
        <lineBasicMaterial color="#8297A8" transparent opacity={0.55} />
      </lineSegments>
    </group>
  );
}

export default CampusSiteLines;


