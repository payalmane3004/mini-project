import { aggregateHourlyOccupancy } from "../../api/analyticsDashboardData.js";

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function buildHistoricalReadingSeries(summary) {
  const occupancy = Array.isArray(summary?.occupancy_readings)
    ? summary.occupancy_readings.filter((reading) => (
      isValidTimestamp(reading.recorded_at)
      && Number.isInteger(reading.occupied_count)
      && reading.occupied_count >= 0
    ))
    : [];
  const energy = Array.isArray(summary?.energy_readings)
    ? summary.energy_readings.flatMap((reading) => {
      const timestampMs = isValidTimestamp(reading.recorded_at) ? Date.parse(reading.recorded_at) : NaN;
      const energyKwh = Number(reading.energy_kwh);
      return Number.isFinite(timestampMs) && Number.isFinite(energyKwh) && energyKwh >= 0
        ? [{ ...reading, timestampMs, energyKwh }]
        : [];
    })
    : [];

  return {
    occupancy,
    occupancyByHour: aggregateHourlyOccupancy(occupancy),
    energy,
    occupancyTotal: Number.isInteger(summary?.occupancy_readings_total) ? summary.occupancy_readings_total : 0,
    energyTotal: Number.isInteger(summary?.energy_readings_total) ? summary.energy_readings_total : 0,
    occupancyTruncated: Boolean(summary?.occupancy_truncated),
    energyTruncated: Boolean(summary?.energy_truncated),
  };
}

export function getForecastReadiness(series) {
  if (!series || (series.occupancy.length === 0 && series.energy.length === 0)) {
    return {
      status: "Insufficient historical data",
      detail: "No timestamped occupancy or energy readings are available in this period, and no forecasting service or validated model is configured.",
    };
  }
  return {
    status: "Not configured",
    detail: "Historical readings are available, but this application has no forecasting service or validated model.",
  };
}

export function getPredictionPageState({ loading, error, series }) {
  if (loading) return "loading";
  if (error) return "error";
  if (!series || (series.occupancy.length === 0 && series.energy.length === 0)) return "insufficient";
  return "history";
}

export function formatSelectedPeriod(start, end) {
  if (!start && !end) return "All available dates";
  const startLabel = start || "Earliest available";
  const endLabel = end || "Latest available";
  return `${startLabel} through ${endLabel}`;
}
