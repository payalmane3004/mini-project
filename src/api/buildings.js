
import { apiFetch } from "./client.js";
import { validateBuildingList, validateRoomList } from "./directoryContracts.js";

async function fetchJson(path, resourceName) {
  let response;
  try {
    response = await apiFetch(path);
  } catch {
    throw new Error("Could not reach the CampusSphere API. Check that the backend is running.");
  }

  if (!response.ok) {
    throw new Error(`Could not load ${resourceName} (HTTP ${response.status}).`);
  }

  return response.json();
}

export async function fetchBuildings() {
  const buildings = await fetchJson("/buildings", "database buildings");
  return validateBuildingList(buildings);
}

export async function fetchRooms() {
  const rooms = await fetchJson("/rooms", "database rooms");
  return validateRoomList(rooms);
}

export async function fetchBuildingRooms(buildingCode) {
  const rooms = await fetchJson(
    `/buildings/${encodeURIComponent(buildingCode)}/rooms`,
    `rooms for ${buildingCode}`,
  );
  return validateRoomList(rooms);
}

export async function fetchBuildingFloorLabels(buildingCode, floorNumber) {
  const query = new URLSearchParams({ floor_number: String(floorNumber) });
  const result = await fetchJson(
    `/buildings/${encodeURIComponent(buildingCode)}/floor-labels?${query}`,
    `floor annotations for ${buildingCode}`,
  );
  if (!Array.isArray(result?.floor_labels)) {
    throw new Error("The floor-labels API returned an unexpected response.");
  }
  return result;
}

export async function createRoom(room) {
  let response;
  try {
    response = await apiFetch("/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(room),
    });
  } catch (error) {
    throw new Error(error.message || "Could not reach the CampusSphere API.", { cause: error });
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    const message = typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((issue) => `${issue.loc?.at(-1) || "Room"}: ${issue.msg}`).join(" ")
        : `Could not create room (HTTP ${response.status}).`;
    throw new Error(message);
  }

  const createdRoom = await response.json();
  if (!Number.isInteger(createdRoom?.id) || createdRoom.room_code !== room.room_code) {
    throw new Error("The room API returned an unexpected response.");
  }
  return createdRoom;
}
