import { apiFetch } from "./client.js";
import { validateEnergyResponse } from "./resourceContracts.js";

export async function fetchEnergyReadings({ start, end, buildingCode, limit = 1000, includeDemo = false, signal } = {}) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  if (buildingCode) query.set("building_code", buildingCode);
  if (includeDemo) query.set("include_demo", "true");

  let response;
  try {
    response = await apiFetch(`/energy/readings?${query}`, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the CampusSphere API. Check that the backend is running.", { cause: error });
  }

  if (!response.ok) {
    throw new Error(`Could not load energy readings (HTTP ${response.status}).`);
  }

  return validateEnergyResponse(await response.json());
}

export async function fetchStudentEnergyReadings({ start, end, buildingCode, limit = 2000, signal } = {}) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  if (buildingCode) query.set("building_code", buildingCode);
  const response = await apiFetch(`/student/energy/readings?${query}`, { signal });
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view simulated energy readings." : `Could not load simulated energy readings (HTTP ${response.status}).`);
  return validateEnergyResponse(await response.json());
}
