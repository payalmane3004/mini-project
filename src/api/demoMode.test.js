import test from "node:test";
import assert from "node:assert/strict";
import { readDemoModeStatus } from "./demoModeStatus.js";

test("demo mode is active only for an explicit boolean server confirmation", () => {
  assert.equal(readDemoModeStatus({ demo_mode: true }), true);
  assert.equal(readDemoModeStatus({ demo_mode: false }), false);
  assert.equal(readDemoModeStatus({}), false);
  assert.equal(readDemoModeStatus({ demo_mode: "true" }), false);
  assert.equal(readDemoModeStatus(null), false);
});
