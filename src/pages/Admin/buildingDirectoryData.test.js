import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectoryEntries,
  filterDirectoryEntries,
  getDirectoryMatchLabel,
  hasSourcePlan,
  summarizeVerifiedRooms,
} from "./buildingDirectoryData.js";

const cad = [{ id: "BLD-A", name: "North / Library" }, { id: "BLD-X", name: "CAD Annex" }];
const records = [
  { id: 10, building_code: "BLD-A", name: "North Library", description: "Verified" },
  { id: 20, building_code: "BLD-B", name: "Science Block", description: null },
];

test("directory entries retain distinct CAD and database-only sources", () => {
  const entries = buildDirectoryEntries(cad, records);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].match.building.id, 10);
  assert.equal(entries[1].match.status, "missing");
  assert.equal(entries[2].source, "database-only");
  assert.equal(getDirectoryMatchLabel(entries[1]), "CAD source annotation · no database match");
});

test("directory search and source filters compose", () => {
  const entries = buildDirectoryEntries(cad, records);
  assert.deepEqual(filterDirectoryEntries(entries, "north", "cad-matched").map(({ id }) => id), ["BLD-A"]);
  assert.deepEqual(filterDirectoryEntries(entries, "annex", "cad-unmatched").map(({ id }) => id), ["BLD-X"]);
  assert.deepEqual(filterDirectoryEntries(entries, "science", "database").map(({ id }) => id), ["BLD-B"]);
  assert.deepEqual(filterDirectoryEntries(entries, "not found", "all"), []);
});

test("room summary counts only fetched verified records and source plans require a target", () => {
  const summary = summarizeVerifiedRooms([{ floor_number: 2 }, { floor_number: 0 }, { floor_number: 2 }]);
  assert.deepEqual(summary, { roomCount: 3, floorNumbers: [0, 2] });
  assert.equal(hasSourcePlan("BLD-A", { "BLD-A": {} }, {}), true);
  assert.equal(hasSourcePlan("BLD-X", {}, {}), false);
});
