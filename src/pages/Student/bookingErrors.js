export function availabilityFailureMessage(reason) {
  if (reason?.status === 401 || reason?.status === 403) return "Your session may have expired. Sign in again to check availability.";
  if (reason?.status === 404) return "This room could not be found. Choose another room.";
  if (reason?.status === 405) return "The booking service does not support availability checks right now. Please try again later.";
  if (reason?.status === 409) return "This room is unavailable for the selected time. Please choose another time.";
  if (reason?.status === 422) return reason.message || "Check that the start time is in the future and the end time is later.";
  if (reason?.status >= 500) return "The booking service could not check availability right now. Please try again shortly.";
  if (!reason?.status) return "Could not reach the booking service. Check your connection and retry availability.";
  return "Availability could not be checked. Please try again shortly.";
}

export function bookingFailureMessage(reason) {
  if (reason?.status === 401 || reason?.status === 403) return "Your session may have expired. Sign in again before requesting a room.";
  if (reason?.status === 404) return "This room could not be found. Choose another room.";
  if (reason?.status === 422) return "Review the room, future start time, end time, and purpose, then try again.";
  if (reason?.status >= 500) return "The booking service could not save this request. Please try again shortly.";
  return "The booking could not be submitted. Please review the form and try again.";
}
