import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateHourlyOccupancy,
  isCurrentAlert,
  isValidAnalyticsDateRange,
  recentCampusRecords,
  summarizeBookings,
  toAnalyticsDateBounds,
  validateAdminAlertList,
  validateAdminBookingList,
} from "./analyticsDashboardData.js";

test("booking counts group the four supported database statuses", () => {
  const bookings = ["PENDING", "APPROVED", "APPROVED", "REJECTED", "CANCELLED"].map((status, id) => ({ id, status }));
  assert.deepEqual(summarizeBookings(bookings), { PENDING: 1, APPROVED: 2, REJECTED: 1, CANCELLED: 1 });
  const withDemo = [...bookings, { status: "PENDING", room_code: "DEMO-B-101" }];
  assert.deepEqual(summarizeBookings(withDemo), { PENDING: 1, APPROVED: 2, REJECTED: 1, CANCELLED: 1 });
  assert.deepEqual(summarizeBookings(withDemo, true), { PENDING: 2, APPROVED: 2, REJECTED: 1, CANCELLED: 1 });
});

test("booking and alert API contracts reject malformed rows", () => {
  assert.throws(() => validateAdminBookingList([{ id: 1, status: "CONFIRMED" }]), /unexpected response/);
  assert.throws(() => validateAdminAlertList([{ id: 1, title: "Alert", active: "yes", severity: "HIGH" }]), /unexpected response/);
  assert.throws(() => validateAdminAlertList([{ id: 1, title: "Alert", active: true, severity: "HIGH", expires_at: "not-a-date" }]), /unexpected response/);
});

test("active alert count excludes inactive and expired alert records", () => {
  const now = Date.parse("2025-04-01T12:00:00Z");
  assert.equal(isCurrentAlert({ active: true, expires_at: null }, now), true);
  assert.equal(isCurrentAlert({ active: true, expires_at: "2025-04-01T12:01:00Z" }, now), true);
  assert.equal(isCurrentAlert({ active: true, expires_at: "2025-04-01T11:59:00Z" }, now), false);
  assert.equal(isCurrentAlert({ active: false, expires_at: null }, now), false);
});

test("occupancy samples are grouped by UTC hour as average stored counts", () => {
  const result = aggregateHourlyOccupancy([
    { recorded_at: "2025-04-01T09:02:00Z", occupied_count: 4 },
    { recorded_at: "2025-04-01T09:58:00Z", occupied_count: 8 },
    { recorded_at: "2025-04-01T10:00:00Z", occupied_count: 2 },
    { recorded_at: null, occupied_count: 100 },
  ]);
  assert.deepEqual(result.map(({ timestamp, averageOccupied, readingCount }) => ({ timestamp, averageOccupied, readingCount })), [
    { timestamp: "2025-04-01T09:00:00.000Z", averageOccupied: 6, readingCount: 2 },
    { timestamp: "2025-04-01T10:00:00.000Z", averageOccupied: 2, readingCount: 1 },
  ]);
});

test("date filters reject reversed or malformed ranges and make the selected end date inclusive", () => {
  assert.equal(isValidAnalyticsDateRange("2025-04-02", "2025-04-01"), false);
  assert.equal(isValidAnalyticsDateRange("2025-02-30", "2025-03-01"), false);
  assert.equal(isValidAnalyticsDateRange("2025-04-01", "2025-04-02"), true);
  assert.deepEqual(toAnalyticsDateBounds("2025-04-01", "2025-04-02"), {
    start: "2025-04-01T00:00:00.000Z",
    end: "2025-04-03T00:00:00.000Z",
  });
});

test("recent activity uses only timestamped records returned by booking and alert APIs", () => {
  const result = recentCampusRecords(
    [{ id: 1, room_code: "R-1", purpose: "Study", status: "PENDING", created_at: "2025-01-01T10:00:00Z" }],
    [{ id: 2, title: "Notice", severity: "HIGH", active: true, created_at: null }],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].href, "/booking");
});
