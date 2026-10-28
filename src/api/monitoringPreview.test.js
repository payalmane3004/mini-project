import test from "node:test";
import assert from "node:assert/strict";
import { fetchLatestOccupancy, fetchStudentOccupancyHistory } from "./occupancy.js";
import { fetchEnergyReadings, fetchStudentEnergyReadings } from "./energy.js";

function mockApi(t, body) {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = {
    sessionStorage: { getItem: () => JSON.stringify({ access_token: "admin-test-token" }) },
    dispatchEvent() {},
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(body), { status: 200 });
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  return calls;
}

const occupancyResponse = {
  room_count: 40,
  demo_preview: true,
  readings: [{
    id: 3, room_id: 12, room_code: "DEMO-R12", room_name: "Demo Room 12",
    building_code: "DEMO-B1", building_name: "Demo Building", floor_number: 1,
    capacity: 20, is_demo: true, occupied_count: 8, source: "SIMULATED_DEMO",
    recorded_at: "2026-10-24T07:00:00Z",
  }],
};

const energyResponse = {
  unit: "kWh", limit: 1000, truncated: false,
  readings: [{
    id: 4, building_id: 2, building_code: "DEMO-B1", building_name: "Demo Building",
    energy_kwh: 4.25, reading_source: "SIMULATED_DEMO", recorded_at: "2026-10-24T07:00:00Z",
  }],
};

test("admin occupancy preview requests simulated latest readings with bearer auth", async (t) => {
  const calls = mockApi(t, occupancyResponse);
  const response = await fetchLatestOccupancy({ includeDemo: true });
  assert.equal(calls[0].url, "http://127.0.0.1:8000/occupancy?include_demo=true");
  assert.equal(new Headers(calls[0].options.headers).get("Authorization"), "Bearer admin-test-token");
  assert.equal(response.demo_preview, true);
  assert.equal(response.readings.length, 1);
  assert.equal(response.readings[0].source, "SIMULATED_DEMO");
});

test("admin occupancy operational request omits the simulated preview opt-in", async (t) => {
  const calls = mockApi(t, { ...occupancyResponse, demo_preview: false, readings: [] });
  const response = await fetchLatestOccupancy();
  assert.equal(calls[0].url, "http://127.0.0.1:8000/occupancy");
  assert.deepEqual(response.readings, []);
});

test("admin energy preview opts in while retaining the response schema and auth", async (t) => {
  const calls = mockApi(t, energyResponse);
  const response = await fetchEnergyReadings({ includeDemo: true });
  assert.equal(calls[0].url, "http://127.0.0.1:8000/energy/readings?limit=1000&include_demo=true");
  assert.equal(new Headers(calls[0].options.headers).get("Authorization"), "Bearer admin-test-token");
  assert.equal(response.readings.length, 1);
  assert.equal(response.readings[0].reading_source, "SIMULATED_DEMO");
});

test("admin energy operational request omits the simulated preview opt-in", async (t) => {
  const calls = mockApi(t, { ...energyResponse, readings: [] });
  const response = await fetchEnergyReadings();
  assert.equal(calls[0].url, "http://127.0.0.1:8000/energy/readings?limit=1000");
  assert.deepEqual(response.readings, []);
});

test("student occupancy history uses its authenticated read-only endpoint", async (t) => {
  const calls = mockApi(t, { ...occupancyResponse, demo_preview: false });
  const response = await fetchStudentOccupancyHistory({ buildingCode: "DEMO-B1", limit: 2000 });
  assert.equal(calls[0].url, "http://127.0.0.1:8000/student/occupancy/history?limit=2000&building_code=DEMO-B1");
  assert.equal(new Headers(calls[0].options.headers).get("Authorization"), "Bearer admin-test-token");
  assert.equal(response.readings[0].source, "SIMULATED_DEMO");
});

test("student energy history uses its authenticated read-only endpoint", async (t) => {
  const calls = mockApi(t, energyResponse);
  const response = await fetchStudentEnergyReadings({ start: "2026-10-17T00:00:00Z", buildingCode: "DEMO-B1" });
  assert.equal(calls[0].url, "http://127.0.0.1:8000/student/energy/readings?limit=2000&start=2026-10-17T00%3A00%3A00Z&building_code=DEMO-B1");
  assert.equal(new Headers(calls[0].options.headers).get("Authorization"), "Bearer admin-test-token");
  assert.equal(response.readings[0].reading_source, "SIMULATED_DEMO");
});
