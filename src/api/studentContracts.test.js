import test from "node:test";
import assert from "node:assert/strict";
import { validateBookingList, validateEmergencyAlertList, validateNoticeList } from "./studentContracts.js";

test("student workflow contracts preserve empty lists", () => {
  assert.deepEqual(validateBookingList([]), []);
  assert.deepEqual(validateNoticeList([]), []);
  assert.deepEqual(validateEmergencyAlertList([]), []);
});

test("student workflow contracts accept booking rows with backend fields", () => {
  const bookings = [{ id: 1, user_id: 2, room_id: 3, room_code: "R-3", building_code: null, purpose: "Study", start_time: "2030-01-01T10:00:00Z", end_time: "2030-01-01T11:00:00Z", status: "PENDING" }];
  assert.equal(validateBookingList(bookings), bookings);
  assert.throws(() => validateBookingList([null]), /unexpected response/);
});

test("student workflow contracts validate published notice fields and optional dates", () => {
  const notices = [{ id: 1, title: "Notice", content: "Details", published: true, created_at: null, expires_at: null }];
  assert.equal(validateNoticeList(notices), notices);
  assert.throws(() => validateNoticeList([{ id: 1, title: "Incomplete" }]), /unexpected response/);
});

test("student workflow contracts validate alert severity and status", () => {
  const alerts = [{ id: 1, title: "Alert", message: "Details", severity: "HIGH", active: true, created_at: null, expires_at: null }];
  assert.equal(validateEmergencyAlertList(alerts), alerts);
  assert.throws(() => validateEmergencyAlertList([{ ...alerts[0], severity: "UNKNOWN" }]), /unexpected response/);
});
