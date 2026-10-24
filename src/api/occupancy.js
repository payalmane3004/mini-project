import { apiFetch } from "./client";
import { validateOccupancyResponse } from "./resourceContracts";

export async function fetchLatestOccupancy({ signal } = {}) {
  let response;
  try {
    response = await apiFetch("/occupancy", { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the CampusSphere API. Check that the backend is running.", { cause: error });
  }

  if (!response.ok) {
    throw new Error(`Could not load occupancy readings (HTTP ${response.status}).`);
  }

  return validateOccupancyResponse(await response.json());
}
