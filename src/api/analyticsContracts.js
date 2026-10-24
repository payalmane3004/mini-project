const isOptionalText = (value) => value === null || value === undefined || typeof value === "string";
const isOptionalTimestamp = isOptionalText;
const isNonnegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

export function normalizeAnalyticsRequestError(error) {
  if (error?.name === "AbortError") return error;
  return new Error("Could not reach the CampusSphere API. Check that the backend is running.", { cause: error });
}

export function validateAnalyticsSummary(result) {
  const counts = [
    "buildings_total", "verified_rooms_total", "occupancy_readings_total",
    "energy_readings_total", "maintenance_open_total", "maintenance_resolved_total",
  ];
  const validOccupancy = Array.isArray(result?.occupancy_readings) && result.occupancy_readings.every((row) => (
    row && Number.isInteger(row.id) && Number.isInteger(row.room_id)
    && typeof row.room_code === "string" && Number.isInteger(row.occupied_count) && row.occupied_count >= 0
    && isOptionalText(row.building_code) && isOptionalText(row.building_name)
    && isOptionalText(row.source) && isOptionalTimestamp(row.recorded_at)
  ));
  const validEnergy = Array.isArray(result?.energy_readings) && result.energy_readings.every((row) => (
    row && Number.isInteger(row.id) && typeof row.building_code === "string"
    && typeof row.building_name === "string" && isNonnegativeNumber(row.energy_kwh)
    && isOptionalText(row.source) && isOptionalTimestamp(row.recorded_at)
  ));
  const validComparison = Array.isArray(result?.energy_by_building) && result.energy_by_building.every((row) => (
    row && typeof row.building_code === "string" && typeof row.building_name === "string"
    && isNonnegativeNumber(row.average_kwh_per_reading)
    && Number.isInteger(row.reading_count) && row.reading_count > 0
    && isOptionalText(row.source)
  ));
  const validUtilization = result?.room_utilization_percent === null
    || (Number.isFinite(result?.room_utilization_percent) && result.room_utilization_percent >= 0);
  if (counts.some((key) => !Number.isInteger(result?.[key]) || result[key] < 0)
    || !result?.period || !isOptionalTimestamp(result.period.start) || !isOptionalTimestamp(result.period.end)
    || !validUtilization || typeof result?.occupancy_truncated !== "boolean"
    || typeof result?.energy_truncated !== "boolean" || !validOccupancy || !validEnergy || !validComparison) {
    throw new Error("The analytics API returned an unexpected response.");
  }
  return result;
}
