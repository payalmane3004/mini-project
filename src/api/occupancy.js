import { apiFetch } from "./client.js";
import { validateOccupancyResponse } from "./resourceContracts.js";

export async function fetchLatestOccupancy({ signal, includeDemo = false } = {}) {
  let response;
  try {
    response = await apiFetch(`/occupancy${includeDemo ? "?include_demo=true" : ""}`, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the CampusSphere API. Check that the backend is running.", { cause: error });
  }

  if (!response.ok) {
    throw new Error(`Could not load occupancy readings (HTTP ${response.status}).`);
  }

  return validateOccupancyResponse(await response.json());
}

export async function fetchStudentOccupancyHistory({ buildingCode, limit = 2000, signal } = {}) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (buildingCode) query.set("building_code", buildingCode);
  const response = await apiFetch(`/student/occupancy/history?${query}`, { signal });
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view simulated occupancy." : `Could not load simulated occupancy (HTTP ${response.status}).`);
  return validateOccupancyResponse(await response.json());
}
