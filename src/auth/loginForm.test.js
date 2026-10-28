import test from "node:test";
import assert from "node:assert/strict";
import { readLoginCredentials } from "./loginForm.js";

test("login submits the named form values instead of potentially stale React state", () => {
  const formData = new FormData();
  formData.set("email", "student@campussphere-demo.example.invalid");
  formData.set("password", "documented-password");

  assert.deepEqual(readLoginCredentials(formData), {
    email: "student@campussphere-demo.example.invalid",
    password: "documented-password",
  });
});

test("missing login form fields become empty strings", () => {
  assert.deepEqual(readLoginCredentials(new FormData()), { email: "", password: "" });
});
