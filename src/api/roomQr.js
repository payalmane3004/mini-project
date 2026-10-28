import { isDemoRoom } from "./demoData.js";

const CAMPUS_ROOM_QR_PREFIX = /^SCAMPUS:ROOM:/i;

export function buildCampusRoomQrPayload(roomCode) {
  return `SCAMPUS:ROOM:${String(roomCode ?? "").trim()}`;
}

export function parseCampusRoomQrPayload(value) {
  const payload = typeof value === "string" ? value.trim() : "";
  if (!payload) return { ok: false, error: "The QR code is empty." };

  // Check the project's custom scheme before URL parsing. `new URL()` accepts
  // SCAMPUS as a protocol, which previously bypassed the legacy QR matcher.
  const campusMatch = payload.match(CAMPUS_ROOM_QR_PREFIX);
  if (campusMatch) {
    const roomCode = payload.slice(campusMatch[0].length).trim();
    return roomCode
      ? { ok: true, roomCode }
      : { ok: false, error: "This CampusSphere QR code does not contain a room code." };
  }
  if (/^SCAMPUS:/i.test(payload)) {
    return { ok: false, error: "Unsupported CampusSphere QR format. Expected SCAMPUS:ROOM:<room-code>." };
  }

  try {
    const url = new URL(payload);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false, error: "Unsupported QR link. Use a campus room link with a location or room parameter." };
    }
    const roomCode = (url.searchParams.get("location") || url.searchParams.get("room") || "").trim();
    return roomCode
      ? { ok: true, roomCode }
      : { ok: false, error: "This QR link does not contain a room location." };
  } catch {
    return { ok: false, error: "Unsupported QR content. Use SCAMPUS:ROOM:<room-code> or a campus link with ?location=<room-code>." };
  }
}

export function findVerifiedRoomByCode(rooms, roomCode, { allowDemo = false } = {}) {
  if (!Array.isArray(rooms) || typeof roomCode !== "string") return null;
  const trimmedCode = roomCode.trim();
  const normalizedCode = trimmedCode.toLocaleUpperCase();
  if (!normalizedCode) return null;
  const eligible = rooms.filter((room) => (
    (allowDemo || !isDemoRoom(room))
    && typeof room.room_code === "string"
    && room.room_code.trim().toLocaleUpperCase() === normalizedCode
  ));
  const exact = eligible.filter((room) => room.room_code.trim() === trimmedCode);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  return eligible.length === 1 ? eligible[0] : null;
}

export function isNewMaintenanceRequestSearch(search) {
  return new URLSearchParams(search).get("newRequest") === "1";
}

export function maintenanceRoomCodeFromSearch(search) {
  if (!isNewMaintenanceRequestSearch(search)) return "";
  return new URLSearchParams(search).get("location") || "";
}

export function maintenanceRoomPrefillFromSearch(search, rooms, { allowDemo = false } = {}) {
  const room = findVerifiedRoomByCode(rooms, maintenanceRoomCodeFromSearch(search), { allowDemo });
  return room ? { roomCode: room.room_code, buildingId: room.building_id, roomId: room.id } : null;
}

export function maintenanceRequestPathForRoomCode(roomCode) {
  return `/student-maintenance?newRequest=1&location=${encodeURIComponent(roomCode)}`;
}

export function createSingleSuccessfulScanHandler(onAccept, onDuplicate = () => {}) {
  let accepted = false;
  return (payload) => {
    if (accepted) {
      onDuplicate(payload);
      return false;
    }
    if (onAccept(payload) !== true) return false;
    accepted = true;
    return true;
  };
}
