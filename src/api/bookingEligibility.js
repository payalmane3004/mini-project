import { isDemoRoom } from "./demoData.js";

export function getBookableRooms(rooms, demoMode) {
  return demoMode ? rooms : rooms.filter((room) => !isDemoRoom(room));
}

export function reconcileBookableRoomId(currentRoomId, rooms) {
  if (rooms.some((room) => String(room.id) === currentRoomId)) return currentRoomId;
  return rooms.length ? String(rooms[0].id) : "";
}

export function validateBookingForm(form, rooms, now = new Date()) {
  if (!rooms.some((room) => String(room.id) === form.room_id)) {
    return "The selected room is not eligible in the current data mode. Choose a listed room or check the demo connection.";
  }
  if (!form.purpose.trim()) return "Enter a purpose for the booking.";
  if (!form.start_time || !form.end_time) return "Choose both a start time and an end time.";

  const start = new Date(form.start_time);
  const end = new Date(form.end_time);
  if (Number.isNaN(+start) || Number.isNaN(+end)) return "Enter valid start and end times.";
  if (start <= now) return "The start time must be in the future.";
  if (start >= end) return "The end time must be after the start time.";
  return "";
}
