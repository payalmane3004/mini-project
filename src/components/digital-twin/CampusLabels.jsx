import { useMemo } from "react";
import { Text } from "@react-three/drei";

import footprintData from "../../data/wce-campus-footprints.json";
import labelData from "../../data/wce-campus-labels.json";

function CampusLabels() {
  const labels = useMemo(() => {
    const points = footprintData.footprints.flatMap((item) => item.polygon);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    const scale = 72 / width;

    return labelData.labels.map((label) => ({
      ...label,
      position: [
        (label.x - minX - width / 2) * scale,
        (label.y - minY - height / 2) * scale,
        0.075,
      ],
      fontSize: label.height * scale,
      rotationRadians: (label.rotation * Math.PI) / 180,
    }));
  }, []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {labels.map((label) => (
        <Text
          key={label.id}
          position={label.position}
          rotation={[0, 0, label.rotationRadians]}
          fontSize={label.fontSize}
          anchorX="left"
          anchorY="bottom"
          color="#E2E8F0"
          outlineWidth={0.004}
          outlineColor="#0B1724"
          raycast={() => null}
          userData={{ cadLayer: label.layer, cadType: label.type }}
        >
          {label.text}
        </Text>
      ))}
    </group>
  );
}

export default CampusLabels;
