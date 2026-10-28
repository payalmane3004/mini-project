import { apiFetch } from "./client";
import { normalizeAnalyticsRequestError, validateAnalyticsSummary } from "./analyticsContracts";

export async function fetchAnalyticsSummary({ start, end, includeDemo = false, signal } = {}) {
  const query = new URLSearchParams();
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  if (includeDemo) query.set("include_demo", "true");
  const suffix = query.size ? `?${query}` : "";

  let response;
  try {
    response = await apiFetch(`/analytics/summary${suffix}`, { signal });
  } catch (error) {
    throw normalizeAnalyticsRequestError(error);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `Could not load analytics (HTTP ${response.status}).`);
  }

  return validateAnalyticsSummary(await response.json());
}
