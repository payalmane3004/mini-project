const optionalText = (value) => value === null || value === undefined || typeof value === "string";

export function validateOccupancyResponse(result) {
  const validReadings = Array.isArray(result?.readings) && result.readings.every((reading) => (
    reading && Number.isInteger(reading.id) && Number.isInteger(reading.room_id)
    && typeof reading.room_code === "string" && Number.isInteger(reading.floor_number)
    && Number.isInteger(reading.occupied_count) && reading.occupied_count >= 0
    && (reading.capacity === null || Number.isInteger(reading.capacity))
    && optionalText(reading.room_name) && optionalText(reading.building_code)
    && optionalText(reading.building_name) && optionalText(reading.source)
    && (reading.is_demo === undefined || typeof reading.is_demo === "boolean")
    && optionalText(reading.recorded_at)
  ));
  if (!Number.isInteger(result?.room_count) || result.room_count < 0 || !validReadings
    || (result.demo_preview !== undefined && typeof result.demo_preview !== "boolean")) {
    throw new Error("The occupancy API returned an unexpected response.");
  }
  return result;
}

export function validateEnergyResponse(result) {
  const validReadings = Array.isArray(result?.readings) && result.readings.every((reading) => (
    reading && Number.isInteger(reading.id) && Number.isInteger(reading.building_id)
    && typeof reading.building_code === "string" && typeof reading.building_name === "string"
    && Number.isFinite(Number(reading.energy_kwh)) && Number(reading.energy_kwh) >= 0
    && optionalText(reading.reading_source) && optionalText(reading.recorded_at)
  ));
  if (result?.unit !== "kWh" || !Number.isInteger(result?.limit) || result.limit < 1
    || typeof result.truncated !== "boolean" || !validReadings) {
    throw new Error("The energy API returned an unexpected response.");
  }
  return result;
}
