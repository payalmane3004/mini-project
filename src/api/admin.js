import { apiFetch } from "./client";

async function request(path, options, fallback) {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `${fallback} (HTTP ${response.status}).`);
  }
  return response.json();
}

export function fetchAdminAlerts() {
  return request("/emergency/alerts", undefined, "Could not load alerts");
}

export function fetchAdminBookings() {
  return request("/bookings", undefined, "Could not load bookings");
}

export function updateAdminBookingStatus(bookingId, status) {
  return request(`/bookings/${encodeURIComponent(bookingId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }, "Could not update booking status");
}

export function publishEmergencyAlert(alert) {
  return request("/emergency/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alert),
  }, "Could not publish alert");
}

export function deactivateEmergencyAlert(alertId) {
  return request(`/emergency/alerts/${encodeURIComponent(alertId)}/deactivate`, { method: "PATCH" }, "Could not deactivate alert");
}
