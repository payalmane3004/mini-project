export function monitoringView({ loading, error, rows }) {
  if (loading) return "loading";
  if (error) return "error";
  return rows.length ? "populated" : "empty";
}

function validTime(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function monitoringDateRange(readings) {
  const dates = readings.map((reading) => validTime(reading.recorded_at))
    .filter(Boolean)
    .map((date) => date.toISOString().slice(0, 10))
    .sort();
  return { from: dates[0] || "", through: dates.at(-1) || "" };
}

export function monitoringBuildingOptions(buildings = []) {
  return [...buildings]
    .filter((building) => typeof building?.building_code === "string" && building.building_code.trim())
    .sort((a, b) => a.building_code.localeCompare(b.building_code))
    .map((building) => ({
      id: building.id,
      code: building.building_code,
      name: typeof building.name === "string" ? building.name : building.building_code,
    }));
}

export function monitoringRoomOptions(rooms = [], buildingCode = "", buildings = []) {
  const buildingIds = new Set(buildings
    .filter((building) => !buildingCode || building.building_code === buildingCode)
    .map((building) => String(building.id)));
  return [...rooms]
    .filter((room) => room && (!buildingCode || buildingIds.has(String(room.building_id))))
    .sort((a, b) => (a.room_code || "").localeCompare(b.room_code || ""));
}

export function filterReadingsByDates(readings, from, through) {
  const start = from ? Date.parse(`${from}T00:00:00Z`) : Number.NEGATIVE_INFINITY;
  const end = through ? Date.parse(`${through}T23:59:59.999Z`) : Number.POSITIVE_INFINITY;
  return readings.filter((reading) => {
    const time = validTime(reading.recorded_at)?.getTime();
    return time !== undefined && time >= start && time <= end;
  });
}

export function latestByKey(readings, keyName) {
  const latest = new Map();
  readings.forEach((reading) => {
    const time = validTime(reading.recorded_at);
    if (!time) return;
    const key = reading[keyName];
    const old = latest.get(key);
    if (!old || time > old.time) latest.set(key, { reading, time });
  });
  return [...latest.values()].map(({ reading }) => reading);
}

export function occupancySummary(readings) {
  const ordered = readings.map((reading) => ({ reading, time: validTime(reading.recorded_at) }))
    .filter((entry) => entry.time).sort((a, b) => a.time - b.time);
  const latest = ordered.at(-1)?.reading || null;
  const latestCapacity = Number.isInteger(latest?.capacity) && latest.capacity > 0 ? latest.capacity : null;
  return {
    roomCount: new Set(readings.map((reading) => reading.room_id)).size,
    latest,
    latestCapacity,
    latestPercent: latestCapacity ? Math.round(latest.occupied_count / latestCapacity * 100) : null,
    latestTimestamp: ordered.at(-1)?.time || null,
    roomReadings: latestByKey(readings, "room_id").sort((a, b) => a.room_code.localeCompare(b.room_code)),
  };
}

export function occupancyTrend(readings) {
  const buckets = new Map();
  readings.forEach((reading) => {
    const time = validTime(reading.recorded_at);
    if (!time) return;
    const key = time.toISOString();
    const bucket = buckets.get(key) || { timestamp: time.getTime(), label: time.toLocaleString(), total: 0, count: 0 };
    bucket.total += reading.occupied_count;
    bucket.count += 1;
    buckets.set(key, bucket);
  });
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp)
    .map((bucket) => ({ ...bucket, average: bucket.total / bucket.count }));
}

export function energySummary(readings) {
  const ordered = readings.map((reading) => ({ reading, time: validTime(reading.recorded_at) }))
    .filter((entry) => entry.time).sort((a, b) => a.time - b.time);
  return {
    readingCount: readings.length,
    buildingCount: new Set(readings.map((reading) => reading.building_id)).size,
    latest: ordered.at(-1)?.reading || null,
    latestTimestamp: ordered.at(-1)?.time || null,
    latestByBuilding: latestByKey(readings, "building_id").sort((a, b) => a.building_code.localeCompare(b.building_code)),
  };
}

export function energyTrend(readings) {
  const buckets = new Map();
  readings.forEach((reading) => {
    const time = validTime(reading.recorded_at);
    const value = Number(reading.energy_kwh);
    if (!time || !Number.isFinite(value) || value < 0) return;
    const date = time.toISOString().slice(0, 10);
    const bucket = buckets.get(date) || { date, total: 0, samples: 0 };
    bucket.total += value;
    bucket.samples += 1;
    buckets.set(date, bucket);
  });
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date))
    .map((bucket) => ({ ...bucket, averageKwh: bucket.total / bucket.samples }));
}

export function dateStartUtc(date) {
  return date ? `${date}T00:00:00Z` : undefined;
}

export function dateEndExclusiveUtc(date) {
  if (!date) return undefined;
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString();
}
