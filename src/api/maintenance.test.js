import test from "node:test";
import assert from "node:assert/strict";
import {
  createMyMaintenanceRequest,
  updateMaintenanceRequestStatus,
} from "./maintenance.js";
import { fetchRooms } from "./buildings.js";
import { validateMaintenanceRequestList } from "./maintenanceContracts.js";

const requestRow = {
  id: 8,
  room_id: 31,
  room_code: "A-101",
  room_name: "Lecture Room 101",
  building_code: "BLD-A",
  building_name: "Academic Block",
  reported_by: 12,
  reporter_name: "Student One",
  title: "Broken projector",
  description: "No image",
  priority: "HIGH",
  status: "OPEN",
  created_at: "2026-10-26T09:00:00Z",
  resolved_at: null,
};

function installRequestMocks(t, respond) {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = {
    sessionStorage: { getItem: () => JSON.stringify({ access_token: "test-token" }) },
    dispatchEvent() {},
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return respond(url, options);
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  return calls;
}

test("maintenance contract accepts real empty results and rejects malformed rows", () => {
  assert.deepEqual(validateMaintenanceRequestList([]), []);
  assert.throws(() => validateMaintenanceRequestList([{ ...requestRow, status: "PENDING" }]), /unexpected response/);
});

test("student create uses bearer auth and does not accept a client owner ID", async (t) => {
  const calls = installRequestMocks(t, async () => new Response(JSON.stringify(requestRow), { status: 201 }));
  const created = await createMyMaintenanceRequest({
    room_id: 31, title: "Broken projector", description: "No image", priority: "HIGH",
  });
  assert.equal(created.id, 8);
  assert.equal(calls[0].url, "http://127.0.0.1:8000/maintenance/requests");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(new Headers(calls[0].options.headers).get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    room_id: 31, title: "Broken projector", description: "No image", priority: "HIGH",
  });
  assert.equal(new Headers(calls[0].options.headers).get("Authorization"), "Bearer test-token");
});

test("maintenance submission shows field-level validation errors returned by the API", async (t) => {
  installRequestMocks(t, async () => new Response(JSON.stringify({
    detail: [{ loc: ["body", "title"], msg: "String should have at least 1 character" }],
  }), { status: 422 }));
  await assert.rejects(createMyMaintenanceRequest({}), /title: String should have at least 1 character/);
});

test("admin status update uses the protected status endpoint and validates its result", async (t) => {
  const updated = { ...requestRow, status: "RESOLVED", resolved_at: "2026-10-26T09:30:00Z" };
  const calls = installRequestMocks(t, async () => new Response(JSON.stringify(updated), { status: 200 }));
  const result = await updateMaintenanceRequestStatus(8, "RESOLVED");
  assert.equal(result.status, "RESOLVED");
  assert.equal(calls[0].url, "http://127.0.0.1:8000/maintenance/requests/8/status");
  assert.equal(calls[0].options.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[0].options.body), { status: "RESOLVED" });
});

test("room inventory API accepts empty and actual room records", async (t) => {
  const rows = [{ id: 31, building_id: 21, room_code: "A-101", room_name: "Lecture Room 101", floor_number: 1, capacity: 30, room_type: "CLASSROOM" }];
  const calls = installRequestMocks(t, async () => new Response(JSON.stringify(rows), { status: 200 }));
  assert.deepEqual(await fetchRooms(), rows);
  assert.equal(calls[0].url, "http://127.0.0.1:8000/rooms");
  assert.equal(new Headers(calls[0].options.headers).get("Authorization"), "Bearer test-token");
});

test("room inventory API distinguishes an empty database from an API failure", async (t) => {
  installRequestMocks(t, async () => new Response("[]", { status: 200 }));
  assert.deepEqual(await fetchRooms(), []);
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "Database unavailable" }), { status: 503 });
  await assert.rejects(fetchRooms(), /HTTP 503/);
});
