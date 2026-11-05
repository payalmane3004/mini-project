import test from "node:test";
import assert from "node:assert/strict";
import { checkBookingAvailability, createMyBooking } from "./student.js";

const bookingResponse = {
  id: 91,
  user_id: 12,
  room_id: 31,
  room_code: "A-101",
  is_demo: false,
  building_code: "BLD-A",
  purpose: "Study group",
  start_time: "2030-01-01T10:00:00Z",
  end_time: "2030-01-01T11:00:00Z",
  status: "PENDING",
};

function mockFetch(t, respond) {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = {
    sessionStorage: { getItem: () => JSON.stringify({ access_token: "student-token" }) },
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

test("student booking sends the backend schema and validates the persisted response", async (t) => {
  const calls = mockFetch(t, async () => new Response(JSON.stringify(bookingResponse), { status: 201 }));
  const payload = {
    room_id: 31,
    purpose: "Study group",
    start_time: "2030-01-01T10:00:00Z",
    end_time: "2030-01-01T11:00:00Z",
  };

  assert.deepEqual(await createMyBooking(payload), bookingResponse);
  assert.equal(calls[0].url, "http://127.0.0.1:8001/bookings");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(new Headers(calls[0].options.headers).get("Authorization"), "Bearer student-token");
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
});

test("availability uses the registered GET route with the selected slot and student auth", async (t) => {
  const calls = mockFetch(t, async () => new Response(JSON.stringify({ available: true }), { status: 200 }));
  const slot = {
    room_id: 31,
    start_time: "2030-01-01T10:00:00.000Z",
    end_time: "2030-01-01T11:00:00.000Z",
  };

  assert.equal(await checkBookingAvailability(slot), true);
  const requestUrl = new URL(calls[0].url);
  assert.equal(`${requestUrl.origin}${requestUrl.pathname}`, "http://127.0.0.1:8001/bookings/availability");
  assert.equal(calls[0].options.method, undefined);
  assert.deepEqual(Object.fromEntries(requestUrl.searchParams), {
    room_id: "31",
    start_time: slot.start_time,
    end_time: slot.end_time,
  });
  assert.equal(new Headers(calls[0].options.headers).get("Authorization"), "Bearer student-token");
});

test("student booking surfaces conflict and field validation errors from the API", async (t) => {
  mockFetch(t, async () => new Response(JSON.stringify({ detail: "This room is already booked during the requested time" }), { status: 409 }));
  await assert.rejects(createMyBooking({}), /already booked during the requested time/);

  globalThis.fetch = async () => new Response(JSON.stringify({
    detail: [{ loc: ["body", "start_time"], msg: "Input should be a valid datetime" }],
  }), { status: 422 });
  await assert.rejects(createMyBooking({}), /start_time: Input should be a valid datetime/);
});

test("student booking does not accept a malformed success response", async (t) => {
  mockFetch(t, async () => new Response(JSON.stringify({ id: 91 }), { status: 201 }));
  await assert.rejects(createMyBooking({}), /unexpected response/);
});
