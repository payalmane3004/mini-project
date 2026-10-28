import test from "node:test";
import assert from "node:assert/strict";
import {
  filterEnergyReadings, filterOperationalRooms, isDemoFloorLabel, isDemoRoom, isSimulatedSource,
} from "./demoData.js";

test("demo classification uses explicit API flags and stable legacy identifiers", () => {
  assert.equal(isDemoRoom({ is_demo: true, room_code: "R-101" }), true);
  assert.equal(isDemoRoom({ room_code: "DEMO-B-101" }), true);
  assert.equal(isDemoRoom({ room_code: "B-101" }), false);
  assert.deepEqual(filterOperationalRooms([
    { id: 1, room_code: "A-101" },
    { id: 2, room_code: "DEMO-A-102" },
  ]).map(({ id }) => id), [1]);
  assert.equal(isDemoFloorLabel({ is_demo: true, label: "Floor 1" }), true);
  assert.equal(isDemoFloorLabel({ label: "DEMO TEST FLOOR 1" }), true);
  assert.equal(isDemoFloorLabel({ label: "DEMO Ground Floor · fictional import label" }), true);
  assert.equal(isDemoFloorLabel({ label: "First Floor" }), false);
});

test("simulated source variants are recognized consistently", () => {
  for (const source of ["SIMULATED", "SIMULATED_DEMO", "simulated fixture", "simulator"]) {
    assert.equal(isSimulatedSource(source), true, source);
  }
  assert.equal(isSimulatedSource("RECORDED_VIDEO"), false);
  assert.equal(isSimulatedSource(null), false);
});

test("energy source filters group simulated variants consistently", () => {
  const readings = [
    { id: 1, reading_source: "METER" },
    { id: 2, reading_source: "SIMULATED" },
    { id: 3, reading_source: "SIMULATED_DEMO" },
    { id: 4, reading_source: "simulated fixture" },
  ];
  assert.deepEqual(filterEnergyReadings(readings, "simulated").map(({ id }) => id), [2, 3, 4]);
  assert.deepEqual(filterEnergyReadings(readings, "recorded").map(({ id }) => id), [1]);
  assert.deepEqual(filterEnergyReadings(readings, "all"), readings);
});
