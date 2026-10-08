import { useEffect, useMemo } from "react";
import * as THREE from "three";

import footprintData from "../../data/wce-campus-footprints.json";
import labelData from "../../data/wce-building-labels.json";
import CampusBuilding from "./CampusBuilding";
import { normalizeCadPoint } from "./cadCoordinates";

// Visualization only: the DXF contains no surveyed building heights.
export const TEMPORARY_VISUALIZATION_BUILDING_HEIGHT = 1.25;

function CampusFootprints({ selectedId, onSelectBuilding }) {
  const labelMap = useMemo(() => {
    return Object.fromEntries(
      labelData.buildings.map((item) => [item.footprintId, item.labels])
    );
  }, []);

  const geometryData = useMemo(() => {
    return footprintData.footprints.map((footprint) => {
      const shape = new THREE.Shape();

      footprint.polygon.forEach(([x, y], index) => {
        const [px, py] = normalizeCadPoint(x, y);
        if (index === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      });
      shape.closePath();

      footprint.holes?.forEach((hole) => {
        const holePath = new THREE.Path();
        hole.forEach(([x, y], index) => {
          const [px, py] = normalizeCadPoint(x, y);
          if (index === 0) holePath.moveTo(px, py);
          else holePath.lineTo(px, py);
        });
        holePath.closePath();
        shape.holes.push(holePath);
      });

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: TEMPORARY_VISUALIZATION_BUILDING_HEIGHT,
        bevelEnabled: false,
        curveSegments: 1,
      });
      geometry.computeVertexNormals();
      const edges = new THREE.EdgesGeometry(geometry, 1);

      return { id: footprint.id, geometry, edges };
    });
  }, []);

  useEffect(() => {
    return () => {
      geometryData.forEach(({ geometry, edges }) => {
        geometry.dispose();
        edges.dispose();
      });
    };
  }, [geometryData]);

  function handleSelect(id) {
    const labels = labelMap[id] || [];
    onSelectBuilding?.({
      id,
      code: id,
      name: labels.length ? labels.join(" / ") : "Unnamed CAD footprint",
      sourceLabels: labels,
    });
  }

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {geometryData.map(({ id, geometry, edges }) => (
        <CampusBuilding
          key={id}
          id={id}
          geometry={geometry}
          edges={edges}
          selected={selectedId === id}
          onSelect={handleSelect}
        />
      ))}
    </group>
  );
}

export default CampusFootprints;
