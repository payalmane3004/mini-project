import test from "node:test";
import assert from "node:assert/strict";
import { dashboardListState, dashboardLoadingState } from "./dashboardData.js";

test("dashboard resources show loading until the request settles", () => {
  assert.deepEqual(dashboardLoadingState(), { status: "loading", data: [], error: "" });
});

test("dashboard resources preserve real empty API results", () => {
  assert.deepEqual(dashboardListState({ status: "fulfilled", value: [] }, "notices"), {
    status: "ready", data: [], error: "",
  });
});

test("dashboard resources report request failures without throwing", () => {
  assert.deepEqual(dashboardListState({ status: "rejected", reason: new Error("API unavailable") }, "bookings"), {
    status: "error", data: [], error: "API unavailable",
  });
});

test("dashboard resources reject malformed lists and rows before rendering", () => {
  for (const value of [{ items: [] }, [null], ["unexpected"]]) {
    assert.equal(dashboardListState({ status: "fulfilled", value }, "bookings").status, "error");
  }
});
