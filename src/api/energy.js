import { apiFetch } from "./client";
import { validateEnergyResponse } from "./resourceContracts";

export async function fetchEnergyReadings({ start, end, buildingCode, limit = 1000, signal } = {}) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  if (buildingCode) query.set("building_code", buildingCode);

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
