import test from "node:test";
import assert from "node:assert/strict";
import {
  dateEndExclusiveUtc, energySummary, energyTrend, filterReadingsByDates,
  monitoringBuildingOptions, monitoringDateRange, monitoringRoomOptions, monitoringView,
  occupancySummary, occupancyTrend,
} from "./studentMonitoringData.js";

test("monitoring view distinguishes loading, error, empty, and populated states", () => {
  assert.equal(monitoringView({ loading: true, error: "", rows: [] }), "loading");
  assert.equal(monitoringView({ loading: false, error: "offline", rows: [] }), "error");
  assert.equal(monitoringView({ loading: false, error: "", rows: [] }), "empty");
  assert.equal(monitoringView({ loading: false, error: "", rows: [{ id: 1 }] }), "populated");
});

test("monitoring filters use all directory buildings and rooms, including facilities without readings", () => {
  const buildings = [
    { id: 2, building_code: "DEMO-B02", name: "Second Building" },
    { id: 1, building_code: "DEMO-B01", name: "First Building" },
  ];
  const rooms = [
    { id: 21, building_id: 2, room_code: "DEMO-B02-R1", room_name: "Room 1" },
    { id: 11, building_id: 1, room_code: "DEMO-B01-R1", room_name: "Room 1" },
  ];
  assert.deepEqual(monitoringBuildingOptions(buildings).map(({ code }) => code), ["DEMO-B01", "DEMO-B02"]);
  assert.deepEqual(monitoringRoomOptions(rooms, "DEMO-B02", buildings).map(({ id }) => id), [21]);
  assert.deepEqual(monitoringRoomOptions(rooms, "", buildings).map(({ id }) => id), [11, 21]);
});

test("occupancy summary uses the latest timestamp and reports capacity only when valid", () => {
  const rows = [
    { id: 1, room_id: 2, room_code: "R2", occupied_count: 5, capacity: 20, recorded_at: "2026-04-01T10:00:00Z" },
    { id: 2, room_id: 2, room_code: "R2", occupied_count: 10, capacity: 20, recorded_at: "2026-04-02T10:00:00Z" },
    { id: 3, room_id: 3, room_code: "R3", occupied_count: 2, capacity: 0, recorded_at: "2026-04-02T09:00:00Z" },
  ];
  const summary = occupancySummary(rows);
  assert.equal(summary.roomCount, 2);
  assert.equal(summary.latest.id, 2);
  assert.equal(summary.latestPercent, 50);
  assert.deepEqual(occupancyTrend(rows).map((point) => point.count), [1, 1, 1]);
  assert.equal(occupancySummary([rows[2]]).latestPercent, null);
});

test("energy summaries and trends use sample averages, never imply daily consumption totals", () => {
  const rows = [
    { id: 1, building_id: 3, building_code: "B3", energy_kwh: "2", recorded_at: "2026-04-01T10:00:00Z" },
    { id: 2, building_id: 3, building_code: "B3", energy_kwh: "4", recorded_at: "2026-04-01T16:00:00Z" },
    { id: 3, building_id: 4, building_code: "B4", energy_kwh: "3", recorded_at: "2026-04-02T10:00:00Z" },
  ];
  const summary = energySummary(rows);
  assert.equal(summary.readingCount, 3);
  assert.equal(summary.buildingCount, 2);
  assert.equal(summary.latest.id, 3);
  assert.deepEqual(energyTrend(rows).map((day) => day.averageKwh), [3, 3]);
  assert.equal(dateEndExclusiveUtc("2026-04-01"), "2026-04-02T00:00:00.000Z");
});

test("date filters use inclusive UTC calendar dates and skip invalid timestamps", () => {
  const rows = [
    { id: 1, recorded_at: "2026-04-01T23:59:00Z" },
    { id: 2, recorded_at: "2026-04-02T00:00:00Z" },
    { id: 3, recorded_at: "invalid" },
  ];
  assert.deepEqual(filterReadingsByDates(rows, "2026-04-01", "2026-04-01").map((row) => row.id), [1]);
});

test("available date range comes from valid returned reading timestamps", () => {
  assert.deepEqual(monitoringDateRange([
    { recorded_at: "2026-10-24T07:00:00Z" },
    { recorded_at: "2026-10-17T13:00:00Z" },
    { recorded_at: "invalid" },
    { recorded_at: null },
  ]), { from: "2026-10-17", through: "2026-10-24" });
  assert.deepEqual(monitoringDateRange([]), { from: "", through: "" });
});
