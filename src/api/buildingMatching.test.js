import test from "node:test";
import assert from "node:assert/strict";
import { findUniqueBuildingMatch, normalizeBuildingCode, roomsForBuilding } from "./buildingMatching.js";

const records = [
  { id: 1, building_code: "BU-001", name: "North" },
  { id: 2, building_code: "BLDG-2", name: "South" },
];

test("building codes match exact identifiers", () => {
  assert.deepEqual(findUniqueBuildingMatch("BU-001", records), { status: "matched", building: records[0] });
});

test("building codes normalize surrounding whitespace and case", () => {
  assert.equal(normalizeBuildingCode("  bldg-2 "), "BLDG-2");
  assert.deepEqual(findUniqueBuildingMatch(" bldg-2 ", records), { status: "matched", building: records[1] });
});

test("missing and unknown building identifiers do not match", () => {
  assert.deepEqual(findUniqueBuildingMatch("  ", records), { status: "missing", building: null });
  assert.deepEqual(findUniqueBuildingMatch("BU-999", records), { status: "missing", building: null });
});

test("ambiguous normalized codes are not resolved to an arbitrary record", () => {
  const duplicates = [...records, { id: 3, building_code: " bu-001 ", name: "Duplicate" }];
  assert.deepEqual(findUniqueBuildingMatch("bu-001", duplicates), { status: "ambiguous", building: null });
  assert.deepEqual(findUniqueBuildingMatch("BU-001", duplicates), { status: "matched", building: records[0] });
});

test("rooms without a matching database building_id are not associated", () => {
  const rooms = [{ id: 4, building_id: 2 }, { id: 5, building_id: null }, { id: 6, building_id: 99 }];
  assert.deepEqual(roomsForBuilding(rooms, 2), [rooms[0]]);
  assert.deepEqual(roomsForBuilding(rooms, null), []);
});
