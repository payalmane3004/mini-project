import test from "node:test";
import assert from "node:assert/strict";
import { getStudentProfileDetails } from "./profileData.js";

test("student profile details contain only fields from the authenticated user", () => {
  assert.deepEqual(getStudentProfileDetails({
    full_name: "  Asha Student ",
    email: "asha@example.edu",
    role: "student",
    id: 24,
  }), {
    name: "Asha Student",
    email: "asha@example.edu",
    role: "Student",
  });
});

test("student profile uses unavailable labels when account fields are absent", () => {
  assert.deepEqual(getStudentProfileDetails(null), {
    name: "",
    email: "",
    role: "Unavailable",
  });
});
