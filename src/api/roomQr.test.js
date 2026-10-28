import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import {
  createSingleSuccessfulScanHandler,
  buildCampusRoomQrPayload,
  findVerifiedRoomByCode,
  isNewMaintenanceRequestSearch,
  maintenanceRoomCodeFromSearch,
  maintenanceRoomPrefillFromSearch,
  maintenanceRequestPathForRoomCode,
  parseCampusRoomQrPayload,
} from "./roomQr.js";

test("legacy SCAMPUS room payload is parsed before URL schemes", () => {
  assert.deepEqual(parseCampusRoomQrPayload("SCAMPUS:ROOM:A-101"), { ok: true, roomCode: "A-101" });
});

test("generated admin room payload is a QR readable by the existing parser", async () => {
  const payload = buildCampusRoomQrPayload("MECH-1122");
  const matrix = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const rooms = [{ id: 51, building_id: 7, room_code: "MECH-1122", room_name: "Mechanical Dept", floor_number: 2 }];
  assert.ok(matrix.modules.size > 0);
  const parsed = parseCampusRoomQrPayload(payload);
  assert.deepEqual(parsed, { ok: true, roomCode: "MECH-1122" });
  assert.equal(findVerifiedRoomByCode(rooms, parsed.roomCode), rooms[0]);
});

test("admin payload builder and parser preserve supported spaces and punctuation", () => {
  const roomCode = "Mechanical Dept/1122 (North)";
  const payload = buildCampusRoomQrPayload(roomCode);
  assert.equal(payload, "SCAMPUS:ROOM:Mechanical Dept/1122 (North)");
  assert.deepEqual(parseCampusRoomQrPayload(payload), { ok: true, roomCode });
});

test("generated payload parser accepts room codes supported by admin entry", () => {
  assert.deepEqual(parseCampusRoomQrPayload("SCAMPUS:ROOM:Mechanical Dept/1122"), {
    ok: true, roomCode: "Mechanical Dept/1122",
  });
  assert.match(parseCampusRoomQrPayload("SCAMPUS:ROOM:").error, /does not contain a room code/);
});

test("existing room and location URL payloads are supported", () => {
  assert.deepEqual(parseCampusRoomQrPayload("https://campus.example/room?location=A-101"), { ok: true, roomCode: "A-101" });
  assert.deepEqual(parseCampusRoomQrPayload("https://campus.example/room?room=A-102"), { ok: true, roomCode: "A-102" });
});

test("unsupported and incomplete QR payloads return actionable errors", () => {
  assert.match(parseCampusRoomQrPayload("SCAMPUS:BUILDING:B1").error, /Unsupported CampusSphere QR format/);
  assert.match(parseCampusRoomQrPayload("https://campus.example/room").error, /does not contain a room location/);
  assert.match(parseCampusRoomQrPayload("A-101").error, /Unsupported QR content/);
});

test("room lookup selects only an existing non-demo database room", () => {
  const rooms = [{ id: 31, room_code: "A-101" }, { id: 32, room_code: "DEMO-A-102", is_demo: true }];
  assert.equal(findVerifiedRoomByCode(rooms, " a-101 "), rooms[0]);
  assert.equal(findVerifiedRoomByCode(rooms, "UNKNOWN"), null);
  assert.equal(findVerifiedRoomByCode(rooms, "DEMO-A-102"), null);
  assert.equal(findVerifiedRoomByCode(rooms, "UNKNOWN"), null);
});

test("existing demo rooms are eligible only when local demo access is explicit", () => {
  const room = { id: 32, building_id: 12, room_code: "DEMO-A-102", room_name: "Demo Room", is_demo: true };
  assert.equal(findVerifiedRoomByCode([room], "DEMO-A-102"), null);
  assert.equal(findVerifiedRoomByCode([room], "DEMO-A-102", { allowDemo: true }), room);
});

test("room lookup prefers exact codes and rejects ambiguous case-insensitive matches", () => {
  const rooms = [{ id: 1, room_code: "LAB-1" }, { id: 2, room_code: "lab-1" }];
  assert.equal(findVerifiedRoomByCode(rooms, "lab-1"), rooms[1]);
  assert.equal(findVerifiedRoomByCode(rooms, "Lab-1"), null);
});

test("maintenance QR query initializes and preselects only the supplied room code", () => {
  const query = "?newRequest=1&location=A-101";
  const room = { id: 31, building_id: 21, room_code: "A-101" };
  assert.equal(isNewMaintenanceRequestSearch(query), true);
  assert.equal(maintenanceRoomCodeFromSearch(query), "A-101");
  assert.deepEqual(maintenanceRoomPrefillFromSearch(query, [room]), {
    roomCode: "A-101", buildingId: 21, roomId: 31,
  });
  assert.equal(maintenanceRoomPrefillFromSearch(query, [{ ...room, is_demo: true }]), null);
  assert.deepEqual(maintenanceRoomPrefillFromSearch(query, [{ ...room, is_demo: true }], { allowDemo: true }), {
    roomCode: "A-101", buildingId: 21, roomId: 31,
  });
  assert.equal(isNewMaintenanceRequestSearch("?location=A-101"), false);
  assert.equal(maintenanceRoomCodeFromSearch("?newRequest=1"), "");
});

test("successful verified room scan builds the protected student maintenance route", () => {
  assert.equal(maintenanceRequestPathForRoomCode("A-101"), "/student-maintenance?newRequest=1&location=A-101");
  assert.equal(maintenanceRequestPathForRoomCode("Room 1"), "/student-maintenance?newRequest=1&location=Room%201");
});

test("invalid scans do not consume the callback but first accepted scan prevents duplicates", () => {
  let acceptedPayload = "";
  let duplicatePayload = "";
  const handle = createSingleSuccessfulScanHandler((payload) => {
    if (payload !== "valid") return false;
    acceptedPayload = payload;
    return true;
  }, (payload) => { duplicatePayload = payload; });
  assert.equal(handle("invalid"), false);
  assert.equal(handle("valid"), true);
  assert.equal(handle("valid"), false);
  assert.equal(acceptedPayload, "valid");
  assert.equal(duplicatePayload, "valid");
});
