import { apiFetch } from "./client";

async function request(path, options, label) {
  const response = await apiFetch(path, options);
  if (response.status === 204) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `${label} (HTTP ${response.status}).`);
  }
  return response.json();
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const fetchAdminNotices = () => request("/admin/notices", undefined, "Could not load notices");
export const createNotice = (notice) => request("/notices", json("POST", notice), "Could not save notice");
export const updateNotice = (id, changes) => request(`/notices/${encodeURIComponent(id)}`, json("PATCH", changes), "Could not update notice");
export const deleteDraftNotice = (id) => request(`/notices/${encodeURIComponent(id)}`, { method: "DELETE" }, "Could not delete notice");
