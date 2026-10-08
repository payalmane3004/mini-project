import * as THREE from "three";

function CampusBuilding({ id, geometry, edges, selected, onSelect }) {
  return (
    <group>
      <mesh
        geometry={geometry}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
        castShadow
        receiveShadow
        userData={{ footprintId: id }}
      >
        <meshStandardMaterial
          color={selected ? "#22D3EE" : "#29465A"}
          emissive={selected ? "#087E96" : "#000000"}
          emissiveIntensity={selected ? 0.7 : 0}
          roughness={0.72}
          metalness={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial
          color={selected ? "#A5F3FC" : "#6F9AB2"}
          transparent
          opacity={selected ? 1 : 0.9}
        />
      </lineSegments>
    </group>
  );
}

export default CampusBuilding;
