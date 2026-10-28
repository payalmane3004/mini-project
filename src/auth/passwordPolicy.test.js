import test from "node:test";
import assert from "node:assert/strict";
import { passwordPolicyError, validateNewPassword } from "./passwordPolicy.js";

test("password policy requires length and at least three character classes", () => {
  assert.match(passwordPolicyError("short"), /12 characters/);
  assert.match(passwordPolicyError("alllowercasepassword"), /three of/);
  assert.equal(passwordPolicyError("Campus-Demo-Reset-2026!"), "");
});

test("password confirmation is checked before strength", () => {
  assert.equal(validateNewPassword("Campus-Demo-Reset-2026!", "different"), "Passwords do not match.");
  assert.match(validateNewPassword("weak", "weak"), /12 characters/);
  assert.equal(validateNewPassword("Campus-Demo-Reset-2026!", "Campus-Demo-Reset-2026!"), "");
});
