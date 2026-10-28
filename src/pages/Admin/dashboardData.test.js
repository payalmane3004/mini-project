import test from "node:test";
import assert from "node:assert/strict";
import { countCurrentAlerts, countPendingBookings, getDashboardMetricValue } from "./dashboardData.js";

test("dashboard metric preserves a confirmed zero as available data", () => {
  assert.deepEqual(getDashboardMetricValue(0), { available: true, value: 0 });
});

test("dashboard metric distinguishes unavailable, missing, and invalid values from zero", () => {
  assert.deepEqual(getDashboardMetricValue(undefined), { available: false, value: null });
  assert.deepEqual(getDashboardMetricValue(0, false), { available: false, value: 0 });
  assert.deepEqual(getDashboardMetricValue(-1), { available: false, value: null });
  assert.deepEqual(getDashboardMetricValue(1.5), { available: false, value: null });
});

test("dashboard counts only pending booking requests", () => {
  assert.equal(countPendingBookings([
    { status: "PENDING" }, { status: "APPROVED" }, { status: "REJECTED" },
    { status: "CANCELLED" }, { status: "PENDING" },
  ]), 2);
  assert.equal(countPendingBookings([]), 0);
  const demo = [{ status: "PENDING", is_demo: true }];
  assert.equal(countPendingBookings(demo), 0);
  assert.equal(countPendingBookings(demo, true), 1);
});

test("dashboard counts enabled, unexpired alert records only", () => {
  const now = Date.parse("2025-06-10T12:00:00Z");
  assert.equal(countCurrentAlerts([
    { active: true, expires_at: null },
    { active: true, expires_at: "2025-06-10T12:01:00Z" },
    { active: false, expires_at: null },
    { active: true, expires_at: "2025-06-10T11:59:00Z" },
  ], now), 2);
  const demoAlerts = [{ active: true, expires_at: null, title: "DEMO alert: fictional test" }];
  assert.equal(countCurrentAlerts(demoAlerts, now), 0);
  assert.equal(countCurrentAlerts(demoAlerts, now, true), 1);
});
