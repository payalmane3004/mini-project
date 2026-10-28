import { apiErrorMessage, apiFetch } from "./client.js";
import { validateMaintenanceRequest, validateMaintenanceRequestList } from "./maintenanceContracts.js";

async function request(path, options, fallback) {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(apiErrorMessage(body, `${fallback} (HTTP ${response.status}).`));
  }
  return response.json();
}

export function fetchMyMaintenanceRequests() {
  return request("/maintenance/requests", undefined, "Could not load your maintenance requests")
    .then(validateMaintenanceRequestList);
}

export function createMyMaintenanceRequest(maintenanceRequest) {
  return request("/maintenance/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(maintenanceRequest),
  }, "Could not submit your maintenance request").then(validateMaintenanceRequest);
}

export function fetchAdminMaintenanceRequests() {
  return request("/maintenance/requests", undefined, "Could not load maintenance requests")
    .then(validateMaintenanceRequestList);
}

export function updateMaintenanceRequestStatus(requestId, status) {
  return request(`/maintenance/requests/${encodeURIComponent(requestId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }, "Could not update maintenance request status").then(validateMaintenanceRequest);
}
