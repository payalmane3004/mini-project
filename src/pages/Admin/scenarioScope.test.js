import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBuildingClosureScope,
  hasScenarioSourceData,
} from "./scenarioScope.js";

const buildings = [
  { id: 2, building_code: "B-2", name: "South" },
  { id: 3, building_code: "B-3", name: "North" },
];
const rooms = [
  { id: 8, building_id: 2 },
  { id: 9, building_id: 2 },
  { id: 10, building_id: 3 },
  { id: 11, building_id: null },
];

test("scenario calculation requires verified buildings, rooms, and booking data", () => {
  assert.equal(hasScenarioSourceData({ buildings, rooms, bookings: [] }), true);
  assert.equal(hasScenarioSourceData({ buildings, rooms, bookings: null }), false);
  assert.equal(hasScenarioSourceData({ buildings: [], rooms, bookings: [] }), false);
  assert.equal(hasScenarioSourceData({ buildings, rooms: [], bookings: [] }), false);
});

test("closure scope counts only rooms linked to the selected database building", () => {
  const result = calculateBuildingClosureScope(2, buildings, rooms, [], "2030-01-02", 1);
  assert.equal(result.building, buildings[0]);
  assert.equal(result.roomCount, 2);
  assert.equal(result.overlappingBookingCount, 0);
});

test("overlap logic includes pending and approved bookings with strict interval intersection", () => {
  const bookings = [
    { id: 1, room_id: 8, status: "PENDING", start_time: "2030-01-02T08:00:00", end_time: "2030-01-02T09:00:00" },
    { id: 2, room_id: 9, status: "APPROVED", start_time: "2030-01-02T23:00:00", end_time: "2030-01-03T01:00:00" },
    { id: 3, room_id: 8, status: "CANCELLED", start_time: "2030-01-02T08:00:00", end_time: "2030-01-02T09:00:00" },
    { id: 4, room_id: 8, status: "REJECTED", start_time: "2030-01-02T08:00:00", end_time: "2030-01-02T09:00:00" },
    { id: 5, room_id: 10, status: "APPROVED", start_time: "2030-01-02T08:00:00", end_time: "2030-01-02T09:00:00" },
    { id: 6, room_id: 8, status: "APPROVED", start_time: "2030-01-03T00:00:00", end_time: "2030-01-03T01:00:00" },
  ];
  const result = calculateBuildingClosureScope(2, buildings, rooms, bookings, "2030-01-02", 1);
  assert.equal(result.overlappingBookingCount, 2);
});

test("unparseable active booking times prevent reporting a complete overlap count", () => {
  const result = calculateBuildingClosureScope(2, buildings, rooms, [
    { id: 1, room_id: 8, status: "APPROVED", start_time: "bad", end_time: "bad" },
  ], "2030-01-02", 3);
  assert.equal(result.overlappingBookingCount, null);
  assert.equal(result.uncheckableBookingCount, 1);
});

test("unknown building selections and invalid closure inputs do not produce a result", () => {
  assert.equal(calculateBuildingClosureScope(99, buildings, rooms, [], "2030-01-02", 1), null);
  assert.equal(calculateBuildingClosureScope(2, [...buildings, buildings[0]], rooms, [], "2030-01-02", 1), null);
  assert.equal(calculateBuildingClosureScope(2, buildings, rooms, [], "2030-02-31", 1), null);
  assert.equal(calculateBuildingClosureScope(2, buildings, rooms, [], "2030-01-02", 2), null);
  assert.equal(calculateBuildingClosureScope(2, null, rooms, [], "2030-01-02", 1), null);
});
