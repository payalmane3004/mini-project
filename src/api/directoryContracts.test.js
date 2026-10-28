import test from "node:test";
import assert from "node:assert/strict";
import { validateBuildingList, validateRoomList } from "./directoryContracts.js";

test("directory contract accepts a building with an optional description", () => {
  const buildings = [{ id: 1, building_code: "BLD-A", name: "Building A", description: null }];
  assert.equal(validateBuildingList(buildings), buildings);
  assert.equal(validateBuildingList([{ ...buildings[0], is_demo: true }])[0].is_demo, true);
});

test("directory contract rejects malformed building rows", () => {
  assert.throws(() => validateBuildingList([null]), /unexpected response/);
  assert.throws(() => validateBuildingList([{ id: 1, name: "Building A" }]), /unexpected response/);
  assert.throws(() => validateBuildingList([{ id: 1, building_code: "DEMO-A", name: "Demo", is_demo: "yes" }]), /unexpected response/);
});

test("directory contract accepts a room with optional database values", () => {
  const rooms = [{ id: 2, building_id: null, room_code: "R-2", room_name: null, floor_number: 0, capacity: null, room_type: "Classroom" }];
  assert.equal(validateRoomList(rooms), rooms);
  assert.equal(validateRoomList([{ ...rooms[0], is_demo: true }])[0].is_demo, true);
});

test("directory contract rejects malformed room rows", () => {
  assert.throws(() => validateRoomList([null]), /unexpected response/);
  assert.throws(() => validateRoomList([{ id: 2, room_code: "R-2" }]), /unexpected response/);
});
