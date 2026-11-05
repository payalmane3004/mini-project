import test from "node:test";
import assert from "node:assert/strict";
import { validatePredictionSummary } from "./predictions.js";

function summary({ available = false, demoPreview = false } = {}) {
  const quality = {
    records_available: 0,
    records_required: 200,
    distinct_days: 0,
    history_days: 0,
    history_days_required: 28,
    latest_reading: null,
    latest_reading_age_days: 0,
    first_reading: null,
    quality: "limited",
    reason: "No timestamped occupancy observations were found.",
  };
  const points = available ? [{
    forecast_at: "2026-11-06T09:00:00Z",
    expected_utilization_percent: 52.5,
    expected_energy_kwh: 12.25,
  }] : [];
  return {
    demo_preview: demoPreview,
    method: "Same weekday/hour median from recent history.",
    is_validated_model: false,
    forecast_horizon_days: 7,
    requirements: {
      history_days: 28,
      occupancy_records: 200,
      energy_records: 100,
      slot_repeats: 3,
      slot_coverage_percent: 70,
    },
    occupancy: {
      available,
      data_quality: quality,
      coverage_percent: available ? 75 : 0,
      forecast_points: available ? [{ ...points[0], expected_utilization_percent: 52.5 }] : [],
      peak_usage: [],
      underutilized_rooms: [],
    },
    energy: {
      available,
      data_quality: { ...quality, records_required: 100 },
      coverage_percent: available ? 75 : 0,
      forecast_points: available ? [{ ...points[0], expected_energy_kwh: 12.25 }] : [],
    },
    recommendations: [],
  };
}

test("prediction API accepts explicit insufficient-history response", () => {
  const result = validatePredictionSummary(summary());
  assert.equal(result.occupancy.available, false);
  assert.equal(result.occupancy.data_quality.records_available, 0);
  assert.equal(result.energy.data_quality.reason, "No timestamped occupancy observations were found.");
});

test("prediction API accepts forecast points and demo preview label", () => {
  const result = validatePredictionSummary(summary({ available: true, demoPreview: true }));
  assert.equal(result.demo_preview, true);
  assert.equal(result.occupancy.forecast_points[0].expected_utilization_percent, 52.5);
  assert.equal(result.energy.forecast_points[0].expected_energy_kwh, 12.25);
});

test("prediction API rejects malformed forecast values", () => {
  const result = summary({ available: true });
  result.energy.forecast_points[0].expected_energy_kwh = -1;
  assert.throws(() => validatePredictionSummary(result), /unexpected response/);
});
