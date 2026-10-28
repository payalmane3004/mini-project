import { isDemoRoom } from "../../api/demoData.js";

export const CLOSURE_DURATIONS = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
];

const ACTIVE_BOOKING_STATUSES = new Set(["PENDING", "APPROVED"]);

export function hasScenarioSourceData({ buildings, rooms, bookings } = {}) {
  return Array.isArray(buildings) && buildings.length > 0
    && Array.isArray(rooms) && rooms.some((room) => !isDemoRoom(room))
    && Array.isArray(bookings);
}

function getClosureWindow(startDate, durationDays) {
  if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    || !CLOSURE_DURATIONS.some((duration) => duration.days === durationDays)) return null;
  const startDateTime = new Date(`${startDate}T00:00:00`);
  if (!Number.isFinite(startDateTime.getTime())) return null;
  const [year, month, day] = startDate.split("-").map(Number);
  if (startDateTime.getFullYear() !== year || startDateTime.getMonth() + 1 !== month || startDateTime.getDate() !== day) return null;
  const endDateTime = new Date(startDateTime);
  endDateTime.setDate(endDateTime.getDate() + durationDays);
  return { start: startDateTime.getTime(), end: endDateTime.getTime() };
}

export function calculateBuildingClosureScope(buildingId, buildings, rooms, bookings, startDate, durationDays) {
  if (!Array.isArray(buildings) || !Array.isArray(rooms) || !Array.isArray(bookings)
    || !Number.isInteger(buildingId)) return null;
  const window = getClosureWindow(startDate, durationDays);
  if (!window) return null;
  const matches = buildings.filter((building) => building?.id === buildingId);
  if (matches.length !== 1) return null;

  const scopedRooms = rooms.filter((room) => room?.building_id === buildingId && !isDemoRoom(room));
  const roomIds = new Set(scopedRooms.map((room) => room.id));
  const relevantActiveBookings = bookings.filter((booking) => (
    roomIds.has(booking?.room_id)
    && ACTIVE_BOOKING_STATUSES.has(String(booking?.status || "").toUpperCase())
  ));
  const validBookings = [];
  let uncheckableBookingCount = 0;
  relevantActiveBookings.forEach((booking) => {
    const start = Date.parse(booking.start_time);
    const end = Date.parse(booking.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      uncheckableBookingCount += 1;
      return;
    }
    validBookings.push({ booking, start, end });
  });
  const overlappingBookings = validBookings
    .filter(({ start, end }) => start < window.end && end > window.start)
    .map(({ booking }) => booking);

  return {
    building: matches[0],
    durationDays,
    startDate,
    windowStart: window.start,
    windowEnd: window.end,
    roomCount: scopedRooms.length,
    overlappingBookingCount: uncheckableBookingCount === 0 ? overlappingBookings.length : null,
    uncheckableBookingCount,
  };
}
