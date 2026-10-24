import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAnalyticsRequestError, validateAnalyticsSummary } from "./analyticsContracts.js";

const empty = {
  period: { start: null, end: null }, buildings_total: 0, verified_rooms_total: 0,
  occupancy_readings_total: 0, energy_readings_total: 0, maintenance_open_total: 0,
  maintenance_resolved_total: 0, room_utilization_percent: null,
  occupancy_truncated: false, energy_truncated: false,
  occupancy_readings: [], energy_readings: [], energy_by_building: [],
};

test("analytics accepts valid empty data and unavailable utilization", () => {
  assert.equal(validateAnalyticsSummary(empty), empty);
});

test("analytics rejects missing fields and invalid counts", () => {
  assert.throws(() => validateAnalyticsSummary({ ...empty, verified_rooms_total: -1 }), /unexpected response/);
  assert.throws(() => validateAnalyticsSummary({ ...empty, period: undefined }), /unexpected response/);
});

test("analytics rejects malformed occupancy and energy points", () => {
  assert.throws(() => validateAnalyticsSummary({ ...empty, occupancy_readings: [{ id: 1, occupied_count: "unknown" }] }), /unexpected response/);
  assert.throws(() => validateAnalyticsSummary({ ...empty, energy_readings: [{ id: 1, energy_kwh: "NaN" }] }), /unexpected response/);
});

test("analytics preserves missing timestamps and source metadata as unavailable values", () => {
  const withRows = {
    ...empty,
    occupancy_readings: [{ id: 1, room_id: 2, room_code: "R-2", occupied_count: 3, recorded_at: null, source: null }],
    energy_readings: [{ id: 2, building_code: "B-2", building_name: "Block", energy_kwh: "4.5", recorded_at: null, source: null }],
    energy_by_building: [{ building_code: "B-2", building_name: "Block", average_kwh_per_reading: "4.5", reading_count: 1, source: null }],
    occupancy_readings_total: 1,
    energy_readings_total: 1,
  };
  assert.equal(validateAnalyticsSummary(withRows).occupancy_readings[0].recorded_at, null);
  assert.equal(validateAnalyticsSummary(withRows).energy_readings[0].source, null);
});

test("analytics request failures are surfaced and aborted requests stay silent to callers", () => {
  const networkError = new Error("offline");
  const normalized = normalizeAnalyticsRequestError(networkError);
  assert.match(normalized.message, /Could not reach the CampusSphere API/);
  assert.equal(normalized.cause, networkError);
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  assert.equal(normalizeAnalyticsRequestError(abort), abort);
});
