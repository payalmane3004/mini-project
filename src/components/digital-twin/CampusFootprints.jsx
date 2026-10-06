import { useMemo } from "react";
import * as THREE from "three";

import footprintData from "../../data/wce-campus-footprints.json";
import labelData from "../../data/wce-building-labels.json";

function CampusFootprints({ selectedId, onSelectBuilding }) {
  const labelMap = useMemo(() => {
    return Object.fromEntries(
      labelData.buildings.map((item) => [
        item.footprintId,
        item.labels,
      ])
    );
  }, []);

  const geometryData = useMemo(() => {
    const footprints = footprintData.footprints;

    const points = footprints.flatMap(
      (item) => item.polygon
    );

    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;

    const targetWidth = 72;
    const scale = targetWidth / width;

    return footprints.map((footprint) => {
      const shape = new THREE.Shape();

      footprint.polygon.forEach(([x, y], index) => {
        const px =
          (x - minX - width / 2) * scale;

        const py =
          (y - minY - height / 2) * scale;

        if (index === 0) {
          shape.moveTo(px, py);
        } else {
          shape.lineTo(px, py);
        }
      });

      shape.closePath();

      footprint.holes?.forEach((hole) => {
        const holePath = new THREE.Path();

        hole.forEach(([x, y], index) => {
          const px =
            (x - minX - width / 2) * scale;

          const py =
            (y - minY - height / 2) * scale;

          if (index === 0) {
            holePath.moveTo(px, py);
          } else {
            holePath.lineTo(px, py);
          }
        });

        holePath.closePath();
        shape.holes.push(holePath);
      });

      const geometry = new THREE.ShapeGeometry(shape);

      const edges = new THREE.EdgesGeometry(
        geometry,
        1
      );

      return {
        id: footprint.id,
        geometry,
        edges,
      };
    });
  }, []);

  function handleSelect(id) {
    const labels = labelMap[id] || [];

    onSelectBuilding?.({
      id,
      code: id,
      name: labels.length
        ? labels.join(" / ")
        : "Unnamed CAD footprint",
      sourceLabels: labels,
    });
  }

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {geometryData.map(
        ({ id, geometry, edges }) => {
          const selected = selectedId === id;

          return (
            <group key={id}>
              {/* Exact CAD footprint */}
              <mesh
                geometry={geometry}
                position={[0, 0.02, 0]}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSelect(id);
                }}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  document.body.style.cursor =
                    "pointer";
                }}
                onPointerOut={() => {
                  document.body.style.cursor =
                    "default";
                }}
              >
                <meshBasicMaterial
                  color={
                    selected
                      ? "#22D3EE"
                      : "#29465A"
                  }
                  side={THREE.DoubleSide}
                  transparent
                  opacity={selected ? 0.95 : 0.9}
                />
              </mesh>

              {/* Exact footprint outline */}
              <lineSegments
                geometry={edges}
                position={[0, 0.035, 0]}
              >
                <lineBasicMaterial
                  color={
                    selected
                      ? "#67E8F9"
                      : "#5B7C93"
                  }
                  transparent
                  opacity={
                    selected ? 1 : 0.85
                  }
                />
              </lineSegments>
            </group>
          );
        }
      )}
    </group>
  );
}

export default CampusFootprints;