import test from "node:test";
import assert from "node:assert/strict";
import { isInvalidSessionError } from "./authState.js";

test("only an explicit unauthorized response invalidates a saved session", () => {
  assert.equal(isInvalidSessionError({ status: 401 }), true);
  assert.equal(isInvalidSessionError({ status: 403 }), false);
  assert.equal(isInvalidSessionError({ status: 503 }), false);
  assert.equal(isInvalidSessionError(new Error("Could not reach API")), false);
});
