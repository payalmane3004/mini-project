import { isCurrentAlert } from "../../api/analyticsDashboardData.js";

export function getDashboardMetricValue(value, available = true) {
  return {
    available: Boolean(available) && Number.isInteger(value) && value >= 0,
    value: Number.isInteger(value) && value >= 0 ? value : null,
  };
}

export function countPendingBookings(bookings) {
  return bookings.filter((booking) => booking.status.toUpperCase() === "PENDING").length;
}

export function countCurrentAlerts(alerts, now = Date.now()) {
  return alerts.filter((alert) => isCurrentAlert(alert, now)).length;
}
