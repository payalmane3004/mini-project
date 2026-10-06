import { useMemo } from "react";
import * as THREE from "three";

import siteData from "../../data/wce-campus-site-lines.json";

function CampusSiteLines() {
  const geometry = useMemo(() => {
    const { minX, maxX, minY, maxY } = siteData.bounds;

    const width = maxX - minX;
    const height = maxY - minY;

    // Keep the same physical scale as the campus footprints.
    const targetWidth = 72;
    const scale = targetWidth / width;

    const positions = [];

    for (const entity of siteData.entities) {
      const pts = entity.points;

      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];

        positions.push(
          (x1 - minX - width / 2) * scale,
          0.04,
          (y1 - minY - height / 2) * scale,
          (x2 - minX - width / 2) * scale,
          0.04,
          (y2 - minY - height / 2) * scale
        );
      }

      if (entity.closed && pts.length > 2) {
        const [x1, y1] = pts[pts.length - 1];
        const [x2, y2] = pts[0];

        positions.push(
          (x1 - minX - width / 2) * scale,
          0.04,
          (y1 - minY - height / 2) * scale,
          (x2 - minX - width / 2) * scale,
          0.04,
          (y2 - minY - height / 2) * scale
        );
      }
    }

    const buffer = new THREE.BufferGeometry();

    buffer.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    return buffer;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color="#64748B"
        transparent
        opacity={0.65}
      />
    </lineSegments>
  );
}

export default CampusSiteLines;
