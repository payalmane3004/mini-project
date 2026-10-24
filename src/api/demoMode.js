import { apiFetch } from "./client";
import { readDemoModeStatus } from "./demoModeStatus";

export { readDemoModeStatus };

export async function fetchDemoModeStatus() {
  try {
    const response = await apiFetch("/demo/status", { anonymous: true });
    if (!response.ok) return false;
    return readDemoModeStatus(await response.json());
  } catch {
    return false;
  }
}
