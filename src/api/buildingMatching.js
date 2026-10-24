export function normalizeBuildingCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function findUniqueBuildingMatch(code, buildings) {
  const normalized = normalizeBuildingCode(code);
  if (!normalized || !Array.isArray(buildings)) return { status: "missing", building: null };

  const exact = buildings.filter((building) => building?.building_code === code);
  if (exact.length === 1) return { status: "matched", building: exact[0] };
  if (exact.length > 1) return { status: "ambiguous", building: null };

  const matches = buildings.filter((building) => normalizeBuildingCode(building?.building_code) === normalized);
  if (matches.length === 1) return { status: "matched", building: matches[0] };
  return matches.length > 1
    ? { status: "ambiguous", building: null }
    : { status: "missing", building: null };
}

export function roomsForBuilding(rooms, buildingId) {
  return rooms.filter((room) => Number.isInteger(buildingId) && room?.building_id === buildingId);
}
