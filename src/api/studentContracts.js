function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDateTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function assertList(items, isValidItem, label) {
  if (!Array.isArray(items) || items.some((item) => !isValidItem(item))) {
    throw new Error(`The ${label} API returned an unexpected response.`);
  }
  return items;
}

export function validateBookingList(items) {
  return assertList(items, (booking) => (
    isRecord(booking)
    && Number.isInteger(booking.id)
    && Number.isInteger(booking.user_id)
    && Number.isInteger(booking.room_id)
    && typeof booking.room_code === "string"
    && (booking.is_demo === undefined || typeof booking.is_demo === "boolean")
    && (booking.building_code === null || typeof booking.building_code === "string")
    && typeof booking.purpose === "string"
    && isDateTime(booking.start_time)
    && isDateTime(booking.end_time)
    && typeof booking.status === "string"
  ), "bookings");
}

export function validateNoticeList(items) {
  return assertList(items, (notice) => (
    isRecord(notice)
    && Number.isInteger(notice.id)
    && typeof notice.title === "string"
    && typeof notice.content === "string"
    && typeof notice.published === "boolean"
    && (notice.is_demo === undefined || typeof notice.is_demo === "boolean")
    && (notice.created_at == null || isDateTime(notice.created_at))
    && (notice.expires_at == null || isDateTime(notice.expires_at))
  ), "notices");
}

export function validateEmergencyAlertList(items) {
  return assertList(items, (alert) => (
    isRecord(alert)
    && Number.isInteger(alert.id)
    && typeof alert.title === "string"
    && typeof alert.message === "string"
    && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(alert.severity)
    && typeof alert.active === "boolean"
    && (alert.is_demo === undefined || typeof alert.is_demo === "boolean")
    && (alert.created_at == null || isDateTime(alert.created_at))
    && (alert.expires_at == null || isDateTime(alert.expires_at))
  ), "emergency alerts");
}
