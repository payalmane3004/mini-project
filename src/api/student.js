import { apiErrorMessage, apiFetch } from "./client.js";
import { validateBookingList, validateEmergencyAlertList, validateNoticeList } from "./studentContracts.js";

async function request(path, options, fallback) {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(apiErrorMessage(body, `${fallback} (HTTP ${response.status}).`));
    error.status = response.status;
    throw error;
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

export function checkBookingAvailability({ room_id, start_time, end_time }) {
  const query = new URLSearchParams({
    room_id: String(room_id),
    start_time,
    end_time,
  });
  return request(`/bookings/availability?${query}`, undefined, "Could not check room availability").then((result) => {
    if (typeof result?.available !== "boolean") {
      throw new Error("The booking availability API returned an unexpected response.");
    }
    return result.available;
  });
}

export function createMyBooking(booking) {
  return request("/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  }, "Could not create booking").then((created) => validateBookingList([created])[0]);
}

export function cancelMyBooking(bookingId) {
  return request(`/bookings/${encodeURIComponent(bookingId)}`, { method: "DELETE" }, "Could not cancel booking");
}

export function fetchPublishedEmergencyAlerts() {
  return request("/emergency/alerts/published", undefined, "Could not load emergency alerts").then(validateEmergencyAlertList);
}
