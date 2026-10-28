import test from "node:test";
import assert from "node:assert/strict";
import { fetchStudentOccupancyHistory } from "./occupancy.js";
import { fetchStudentEnergyReadings } from "./energy.js";

function installFetch(t, response) {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = { sessionStorage: { getItem: () => JSON.stringify({ access_token: "student-token" }) }, dispatchEvent() {} };
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return response(url, options); };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  return calls;
}

test("student monitoring clients use authenticated read-only student endpoints", async (t) => {
  const calls = installFetch(t, async (url) => new Response(JSON.stringify(
    url.includes("occupancy")
      ? { room_count: 0, demo_preview: true, readings: [] }
      : { unit: "kWh", limit: 2000, truncated: false, readings: [] },
  ), { status: 200 }));
  assert.equal((await fetchStudentOccupancyHistory({ buildingCode: "DEMO-B01" })).readings.length, 0);
  assert.equal((await fetchStudentEnergyReadings({ start: "2026-10-01T00:00:00Z", end: "2026-10-02T00:00:00Z", buildingCode: "DEMO-B01" })).readings.length, 0);
  assert.match(calls[0].url, /\/student\/occupancy\/history\?limit=2000&building_code=DEMO-B01$/);
  assert.match(calls[1].url, /\/student\/energy\/readings\?/);
  for (const call of calls) {
    assert.equal(call.options.method, undefined);
    assert.equal(new Headers(call.options.headers).get("Authorization"), "Bearer student-token");
  }
});

test("student monitoring clients surface endpoint errors instead of treating them as empty data", async (t) => {
  installFetch(t, async () => new Response(JSON.stringify({ detail: "Sign-in required" }), { status: 403 }));
  await assert.rejects(fetchStudentOccupancyHistory(), /HTTP 403/);
  await assert.rejects(fetchStudentEnergyReadings(), /HTTP 403/);
});
