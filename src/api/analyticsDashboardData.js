const BOOKING_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const isOptionalTimestamp = (value) => value === null || value === undefined
  || (typeof value === "string" && !Number.isNaN(new Date(value).getTime()));

export function validateAdminBookingList(bookings) {
  if (!Array.isArray(bookings) || bookings.some((booking) => (
    !booking || !Number.isInteger(booking.id) || !Number.isInteger(booking.room_id)
    || typeof booking.room_code !== "string" || typeof booking.status !== "string"
    || !BOOKING_STATUSES.includes(booking.status.toUpperCase())
    || typeof booking.purpose !== "string"
    || (booking.is_demo !== undefined && typeof booking.is_demo !== "boolean")
    || (booking.is_demo !== undefined && typeof booking.is_demo !== "boolean")
    || typeof booking.start_time !== "string" || typeof booking.end_time !== "string"
    || !isOptionalTimestamp(booking.created_at)
  ))) throw new Error("The bookings API returned an unexpected response.");
  return bookings;
}

export function validateAdminAlertList(alerts) {
  const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  if (!Array.isArray(alerts) || alerts.some((alert) => (
    !alert || !Number.isInteger(alert.id) || typeof alert.title !== "string"
    || typeof alert.active !== "boolean" || !severities.includes(String(alert.severity).toUpperCase())
    || !isOptionalTimestamp(alert.created_at) || !isOptionalTimestamp(alert.expires_at)
    || (alert.is_demo !== undefined && typeof alert.is_demo !== "boolean")
  ))) throw new Error("The alerts API returned an unexpected response.");
  return alerts;
}

export function summarizeBookings(bookings, includeDemo = false) {
  return bookings.filter((booking) => includeDemo || !isDemoBooking(booking)).reduce((counts, booking) => {
    const status = booking.status.toUpperCase();
    counts[status] += 1;
    return counts;
  }, { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 });
}

export function isCurrentAlert(alert, now = Date.now()) {
  if (!alert.active) return false;
  if (!alert.expires_at) return true;
  const expires = new Date(alert.expires_at).getTime();
  return Number.isFinite(expires) && expires > now;
}

export function aggregateHourlyOccupancy(readings) {
  const buckets = new Map();
  for (const reading of readings) {
    const timestamp = reading.recorded_at ? new Date(reading.recorded_at) : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) continue;
    const hour = new Date(Date.UTC(
      timestamp.getUTCFullYear(), timestamp.getUTCMonth(), timestamp.getUTCDate(), timestamp.getUTCHours(),
    ));
    const key = hour.toISOString();
    const bucket = buckets.get(key) || { timestamp: key, total: 0, readingCount: 0, sources: [] };
    bucket.total += reading.occupied_count;
    bucket.readingCount += 1;
    if (reading.source && !bucket.sources.includes(reading.source)) bucket.sources.push(reading.source);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((bucket) => ({
    ...bucket,
    averageOccupied: bucket.total / bucket.readingCount,
  }));
}

export function isValidAnalyticsDateRange(start, end) {
  const validDate = (value) => !value || (typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value);
  return validDate(start) && validDate(end) && (!start || !end || start <= end);
}

export function toAnalyticsDateBounds(start, end) {
  return {
    start: start ? `${start}T00:00:00.000Z` : undefined,
    end: end ? new Date(new Date(`${end}T00:00:00.000Z`).getTime() + 86400000).toISOString() : undefined,
  };
}

export function isDemoBooking(booking) {
  return booking?.is_demo === true
    || (typeof booking?.room_code === "string" && booking.room_code.toUpperCase().startsWith("DEMO-"));
}

export function isDemoAlert(alert) {
  return alert?.is_demo === true
    || (typeof alert?.title === "string" && alert.title.toUpperCase().startsWith("DEMO "));
}

export function recentCampusRecords(bookings, alerts, limit = 6, includeDemo = false) {
  return [
    ...bookings.map((booking) => ({
      type: "booking",
      title: `${booking.room_code} · ${booking.purpose}`,
      label: booking.status.toUpperCase(),
      timestamp: booking.created_at,
      is_demo: isDemoBooking(booking),
      href: "/booking",
    })),
    ...alerts.map((alert) => ({
      type: "alert",
      title: alert.title,
      label: `${alert.severity.toUpperCase()} · ${isCurrentAlert(alert) ? "Active" : alert.active ? "Expired" : "Inactive"}`,
      timestamp: alert.created_at,
      is_demo: isDemoAlert(alert),
      href: "/emergency",
    })),
  ].filter((record) => (includeDemo || !record.is_demo)
    && record.timestamp && !Number.isNaN(new Date(record.timestamp).getTime()))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}
