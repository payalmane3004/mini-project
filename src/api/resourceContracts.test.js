import test from "node:test";
import assert from "node:assert/strict";
import { validateEnergyResponse, validateOccupancyResponse } from "./resourceContracts.js";

test("empty occupancy and energy results remain valid empty states", () => {
  assert.deepEqual(validateOccupancyResponse({ room_count: 4, readings: [] }).readings, []);
  assert.deepEqual(validateEnergyResponse({ unit: "kWh", limit: 1000, truncated: false, readings: [] }).readings, []);
});

test("occupancy readings require a verified room ID and nonnegative integer count", () => {
  const valid = { id: 1, room_id: 7, room_code: "R-7", floor_number: 0, occupied_count: 0, capacity: null, recorded_at: "not-a-date", source: "SIMULATED" };
  assert.equal(validateOccupancyResponse({ room_count: 1, readings: [valid] }).readings[0], valid);
  assert.throws(() => validateOccupancyResponse({ room_count: 1, readings: [{ ...valid, occupied_count: -1 }] }), /unexpected response/);
  assert.throws(() => validateOccupancyResponse({ room_count: 1, readings: [{ ...valid, room_id: null }] }), /unexpected response/);
  assert.throws(() => validateOccupancyResponse({ room_count: 1, demo_preview: "yes", readings: [valid] }), /unexpected response/);
  assert.equal(validateOccupancyResponse({ room_count: 1, demo_preview: true, readings: [{ ...valid, is_demo: true }] }).readings[0].is_demo, true);
});

test("invalid timestamps remain identifiable for UI handling instead of changing readings", () => {
  const row = { id: 1, room_id: 7, room_code: "R-7", floor_number: 0, occupied_count: 2, capacity: 20, recorded_at: "invalid", source: "RECORDED_VIDEO" };
  assert.equal(validateOccupancyResponse({ room_count: 1, readings: [row] }).readings[0].recorded_at, "invalid");
  const energy = { id: 1, building_id: 2, building_code: "B-2", building_name: "Building", energy_kwh: "1.250", recorded_at: "invalid", reading_source: "SIMULATED" };
  assert.equal(validateEnergyResponse({ unit: "kWh", limit: 10, truncated: false, readings: [energy] }).readings[0].recorded_at, "invalid");
});

test("malformed energy values and contract metadata are rejected", () => {
  const row = { id: 1, building_id: 2, building_code: "B-2", building_name: "Building", energy_kwh: "2.5", recorded_at: null, reading_source: null };
  assert.throws(() => validateEnergyResponse({ unit: "kWh", limit: 10, truncated: false, readings: [{ ...row, energy_kwh: "NaN" }] }), /unexpected response/);
  assert.throws(() => validateEnergyResponse({ unit: "MWh", limit: 10, truncated: false, readings: [row] }), /unexpected response/);
});
