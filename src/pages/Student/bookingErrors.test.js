import test from "node:test";
import assert from "node:assert/strict";
import { availabilityFailureMessage } from "./bookingErrors.js";

test("availability errors distinguish auth, missing rooms, stale routes, conflicts, and validation", () => {
  assert.match(availabilityFailureMessage({ status: 401 }), /Sign in again/);
  assert.match(availabilityFailureMessage({ status: 404 }), /room could not be found/);
  assert.match(availabilityFailureMessage({ status: 405 }), /does not support availability/);
  assert.match(availabilityFailureMessage({ status: 409 }), /unavailable for the selected time/);
  assert.equal(availabilityFailureMessage({ status: 422, message: "end_time must be later" }), "end_time must be later");
  assert.match(availabilityFailureMessage({ status: 500 }), /booking service could not check availability/);
  assert.match(availabilityFailureMessage(new TypeError("Failed to fetch")), /Check your connection and retry/);
});
