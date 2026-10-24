import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHistoricalReadingSeries,
  formatSelectedPeriod,
  getForecastReadiness,
  getPredictionPageState,
} from "./predictionsData.js";

const summary = {
  occupancy_readings_total: 3,
  energy_readings_total: 2,
  occupancy_truncated: false,
  energy_truncated: false,
  occupancy_readings: [
    { id: 1, room_id: 1, occupied_count: 4, recorded_at: "2030-01-01T10:05:00Z", source: "RECORDED_VIDEO" },
    { id: 2, room_id: 2, occupied_count: 6, recorded_at: "2030-01-01T10:50:00Z", source: "RECORDED_VIDEO" },
    { id: 3, room_id: 2, occupied_count: 7, recorded_at: null, source: null },
  ],
  energy_readings: [
    { id: 1, building_code: "DEMO-A", building_name: "Demo A", energy_kwh: "2.125", source: "SIMULATED", recorded_at: "2030-01-01T10:00:00Z" },
    { id: 2, building_code: "DEMO-A", building_name: "Demo A", energy_kwh: "3.250", source: "METER", recorded_at: "2030-01-01T11:00:00Z" },
  ],
};

test("predictive request view distinguishes loading, history, empty, and error states", () => {
  const series = buildHistoricalReadingSeries(summary);
  const empty = buildHistoricalReadingSeries({
    occupancy_readings_total: 0,
    energy_readings_total: 0,
    occupancy_readings: [],
    energy_readings: [],
  });
  assert.equal(getPredictionPageState({ loading: true, error: "", series }), "loading");
  assert.equal(getPredictionPageState({ loading: false, error: "API unavailable", series }), "error");
  assert.equal(getPredictionPageState({ loading: false, error: "", series }), "history");
  assert.equal(getPredictionPageState({ loading: false, error: "", series: empty }), "insufficient");
});

test("historical series averages occupancy by UTC hour and retains each energy reading", () => {
  const series = buildHistoricalReadingSeries(summary);
  assert.equal(series.occupancy.length, 2);
  assert.equal(series.occupancyByHour.length, 1);
  assert.equal(series.occupancyByHour[0].averageOccupied, 5);
  assert.equal(series.occupancyByHour[0].readingCount, 2);
  assert.equal(series.energy.length, 2);
  assert.deepEqual(series.energy.map((reading) => reading.energyKwh), [2.125, 3.25]);
  assert.deepEqual(series.energy.map((reading) => reading.source), ["SIMULATED", "METER"]);
  assert.equal(series.occupancyTotal, 3);
  assert.equal(series.energyTotal, 2);
});

test("forecast status never claims a configured model and distinguishes no timestamped history", () => {
  const withHistory = buildHistoricalReadingSeries(summary);
  const empty = buildHistoricalReadingSeries({
    occupancy_readings_total: 1,
    energy_readings_total: 0,
    occupancy_readings: [{ id: 1, room_id: 1, occupied_count: 0, recorded_at: null }],
    energy_readings: [],
  });
  assert.equal(getForecastReadiness(withHistory).status, "Not configured");
  assert.equal(getForecastReadiness(empty).status, "Insufficient historical data");
});

test("selected period labels distinguish all dates from a bounded interval", () => {
  assert.equal(formatSelectedPeriod("", ""), "All available dates");
  assert.equal(formatSelectedPeriod("2030-01-01", "2030-01-31"), "2030-01-01 through 2030-01-31");
});
