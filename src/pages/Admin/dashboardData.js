import { isCurrentAlert, isDemoAlert, isDemoBooking } from "../../api/analyticsDashboardData.js";

export function getDashboardMetricValue(value, available = true) {
  return {
    available: Boolean(available) && Number.isInteger(value) && value >= 0,
    value: Number.isInteger(value) && value >= 0 ? value : null,
  };
}

export function countPendingBookings(bookings, includeDemo = false) {
  return bookings.filter((booking) => booking.status.toUpperCase() === "PENDING"
    && (includeDemo || !isDemoBooking(booking))).length;
}

export function countCurrentAlerts(alerts, now = Date.now(), includeDemo = false) {
  return alerts.filter((alert) => isCurrentAlert(alert, now)
    && (includeDemo || !isDemoAlert(alert))).length;
}
