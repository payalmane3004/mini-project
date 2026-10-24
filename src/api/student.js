import { apiFetch } from "./client";
import { validateBookingList, validateEmergencyAlertList, validateNoticeList } from "./studentContracts";

async function request(path, options, fallback) {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `${fallback} (HTTP ${response.status}).`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function fetchPublishedNotices() {
  return request("/notices", undefined, "Could not load campus notices").then(validateNoticeList);
}

export function fetchMyBookings() {
  return request("/bookings", undefined, "Could not load your bookings").then(validateBookingList);
}

export function createMyBooking(booking) {
  return request("/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  }, "Could not create booking");
}

export function cancelMyBooking(bookingId) {
  return request(`/bookings/${encodeURIComponent(bookingId)}`, { method: "DELETE" }, "Could not cancel booking");
}

export function fetchPublishedEmergencyAlerts() {
  return request("/emergency/alerts/published", undefined, "Could not load emergency alerts").then(validateEmergencyAlertList);
}
