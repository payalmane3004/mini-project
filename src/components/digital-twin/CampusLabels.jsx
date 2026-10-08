import { useMemo } from "react";
import { Text } from "@react-three/drei";

import labelData from "../../data/wce-campus-labels.json";
import { normalizeCadPoint, campusCadScale } from "./cadCoordinates";
import { TEMPORARY_VISUALIZATION_BUILDING_HEIGHT } from "./CampusFootprints";

function CampusLabels() {
  const labels = useMemo(() => {
    return labelData.labels.map((label) => {
      const [x, y] = normalizeCadPoint(label.x, label.y);
      return {
        ...label,
        position: [x, y, TEMPORARY_VISUALIZATION_BUILDING_HEIGHT + 0.04],
        fontSize: label.height * campusCadScale,
        rotationRadians: (label.rotation * Math.PI) / 180,
      };
    });
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
          color="#F1F5F9"
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
