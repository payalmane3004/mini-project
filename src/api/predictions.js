import { apiFetch } from "./client.js";

function validQuality(quality) {
  return quality && Number.isInteger(quality.records_available) && quality.records_available >= 0
    && Number.isInteger(quality.records_required) && quality.records_required > 0
    && Number.isInteger(quality.history_days) && quality.history_days >= 0
    && Number.isInteger(quality.history_days_required) && quality.history_days_required > 0
    && (quality.reason === null || typeof quality.reason === "string");
}

function validPoints(points, metric) {
  return Array.isArray(points) && points.every((point) => (
    point && typeof point.forecast_at === "string" && Number.isFinite(Date.parse(point.forecast_at))
    && Number.isFinite(point[metric]) && point[metric] >= 0
  ));
}

export function validatePredictionSummary(result) {
  const occupancy = result?.occupancy;
  const energy = result?.energy;
  if (typeof result?.demo_preview !== "boolean"
    || typeof result?.method !== "string"
    || typeof result?.is_validated_model !== "boolean"
    || !Number.isInteger(result?.forecast_horizon_days) || result.forecast_horizon_days < 1
    || !occupancy || typeof occupancy.available !== "boolean"
    || !validQuality(occupancy.data_quality)
    || !Number.isFinite(occupancy.coverage_percent) || occupancy.coverage_percent < 0 || occupancy.coverage_percent > 100
    || !validPoints(occupancy.forecast_points, "expected_utilization_percent")
    || !Array.isArray(occupancy.peak_usage)
    || !Array.isArray(occupancy.underutilized_rooms)
    || !energy || typeof energy.available !== "boolean"
    || !validQuality(energy.data_quality)
    || !Number.isFinite(energy.coverage_percent) || energy.coverage_percent < 0 || energy.coverage_percent > 100
    || !validPoints(energy.forecast_points, "expected_energy_kwh")
    || !Array.isArray(result?.recommendations)) {
    throw new Error("The predictive analytics API returned an unexpected response.");
  }
  return result;
}

export async function fetchPredictionSummary({ includeDemo = false, signal } = {}) {
  const query = includeDemo ? "?include_demo=true" : "";
  let response;
  try {
    response = await apiFetch(`/analytics/predictions${query}`, { signal });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error("Could not reach the CampusSphere prediction API.", { cause: error });
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `Could not load predictions (HTTP ${response.status}).`);
  }
  return validatePredictionSummary(await response.json());
}
