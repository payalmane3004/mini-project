export function dashboardLoadingState() {
  return { status: "loading", data: [], error: "" };
}

export function dashboardListState(result, label) {
  if (result.status === "rejected") {
    return { status: "error", data: [], error: result.reason?.message || `Could not load ${label}.` };
  }

  if (!Array.isArray(result.value) || result.value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    return { status: "error", data: [], error: `The ${label} API returned an unexpected response.` };
  }

  return { status: "ready", data: result.value, error: "" };
}
