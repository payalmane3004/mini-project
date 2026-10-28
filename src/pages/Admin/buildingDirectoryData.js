import { findUniqueBuildingMatch } from "../../api/buildingMatching.js";
import { isDemoRoom } from "../../api/demoData.js";

export function buildDirectoryEntries(directory, databaseBuildings) {
  const cadEntries = directory.map((cad) => {
    const match = findUniqueBuildingMatch(cad.id, databaseBuildings);
    const matchedBuilding = match.building;
    return {
      ...cad,
      match,
      source: "cad",
      is_demo: Boolean(matchedBuilding && (
        matchedBuilding.is_demo === true || matchedBuilding.building_code.toUpperCase().startsWith("DEMO-")
      )),
    };
  });
  const matchedRecordIds = new Set(cadEntries
    .filter(({ match }) => match.status === "matched")
    .map(({ match }) => match.building.id));
  const databaseOnly = databaseBuildings
    .filter((record) => !matchedRecordIds.has(record.id))
    .map((record) => ({
      id: record.building_code,
      name: record.name,
      is_demo: record.is_demo === true || record.building_code.toUpperCase().startsWith("DEMO-"),
      match: { status: "matched", building: record },
      source: "database-only",
    }));
  return [...cadEntries, ...databaseOnly];
}

export function filterDirectoryEntries(entries, query, filter) {
  const term = query.trim().toLocaleLowerCase();
  return entries.filter(({ id, name, match, source }) => {
    const databaseName = match.building?.name || "";
    const matchesQuery = !term || `${id} ${name} ${databaseName}`.toLocaleLowerCase().includes(term);
    const matchesFilter = filter === "all"
      || (filter === "cad-matched" && source === "cad" && match.status === "matched")
      || (filter === "cad-unmatched" && source === "cad" && match.status !== "matched")
      || (filter === "database" && (source === "database-only" || match.status === "matched"));
    return matchesQuery && matchesFilter;
  });
}

export function summarizeVerifiedRooms(rooms) {
  const verifiedRooms = rooms.filter((room) => !isDemoRoom(room));
  const demoRooms = rooms.filter(isDemoRoom);
  const floors = [...new Set(verifiedRooms.map(({ floor_number }) => floor_number))].sort((a, b) => a - b);
  return { roomCount: verifiedRooms.length, demoRoomCount: demoRooms.length, floorNumbers: floors };
}

export function hasSourcePlan(buildingId, plans, drawings) {
  return Boolean(plans[buildingId] || drawings[buildingId]);
}

export function getDirectoryMatchLabel(entry) {
  if (entry.source === "database-only") return "Database record · no CAD match";
  if (entry.match.status === "ambiguous") return "Ambiguous database code match";
  if (entry.match.status === "matched") return "CAD footprint matched to database";
  return "CAD source annotation · no database match";
}
