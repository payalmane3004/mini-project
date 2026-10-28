import test from "node:test";
import assert from "node:assert/strict";
import { getBookableRooms, reconcileBookableRoomId, validateBookingForm } from "./bookingEligibility.js";

const rooms = [
  { id: 31, room_code: "A-101", is_demo: false },
  { id: 32, room_code: "DEMO-MECH-1122", is_demo: true },
];

test("demo rooms are selectable only after the server confirms demo mode", () => {
  assert.deepEqual(getBookableRooms(rooms, false), [rooms[0]]);
  assert.deepEqual(getBookableRooms(rooms, true), rooms);
});

test("selected room reconciliation chooses an eligible room and clears stale IDs", () => {
  assert.equal(reconcileBookableRoomId("32", rooms), "32");
  assert.equal(reconcileBookableRoomId("32", getBookableRooms(rooms, false)), "31");
  assert.equal(reconcileBookableRoomId("31", []), "");
});

test("booking validation reports room, purpose, and date problems separately", () => {
  const valid = {
    room_id: "31",
    purpose: "Study group",
    start_time: "2030-01-01T10:00",
    end_time: "2030-01-01T11:00",
  };
  const now = new Date("2029-01-01T00:00:00Z");
  assert.equal(validateBookingForm({ ...valid, room_id: "32" }, [rooms[0]], now), "The selected room is not eligible in the current data mode. Choose a listed room or check the demo connection.");
  assert.equal(validateBookingForm({ ...valid, purpose: " " }, rooms, now), "Enter a purpose for the booking.");
  assert.equal(validateBookingForm({ ...valid, start_time: "" }, rooms, now), "Choose both a start time and an end time.");
  assert.equal(validateBookingForm({ ...valid, start_time: "invalid" }, rooms, now), "Enter valid start and end times.");
  assert.equal(validateBookingForm({ ...valid, start_time: "2028-01-01T10:00" }, rooms, now), "The start time must be in the future.");
  assert.equal(validateBookingForm({ ...valid, end_time: "2030-01-01T09:00" }, rooms, now), "The end time must be after the start time.");
  assert.equal(validateBookingForm(valid, rooms, now), "");
});
