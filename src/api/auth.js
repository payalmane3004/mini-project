import { apiFetch } from "./client";

async function readApiError(response, fallback) {
  const result = await response.json().catch(() => null);
  return new Error(typeof result?.detail === "string" ? result.detail : fallback);
}

export async function loginWithPassword(email, password) {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    anonymous: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await readApiError(response, `Login failed (HTTP ${response.status}).`);

  const result = await response.json();
  if (typeof result?.access_token !== "string"
    || !["admin", "student"].includes(result?.user?.role)
    || !Number.isInteger(result?.user?.id)) {
    throw new Error("The authentication API returned an unexpected response.");
  }
  return result;
}

export async function fetchAuthenticatedUser() {
  const response = await apiFetch("/auth/me");
  if (!response.ok) throw await readApiError(response, `Session validation failed (HTTP ${response.status}).`);

  const user = await response.json();
  if (!Number.isInteger(user?.id) || !["admin", "student"].includes(user?.role)) {
    throw new Error("The authentication API returned an unexpected user.");
  }
  return user;
}
