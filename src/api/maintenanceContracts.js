const nullableText = (value) => value === null || value === undefined || typeof value === "string";
const priorities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const statuses = new Set(["OPEN", "IN_PROGRESS", "RESOLVED"]);

export function validateMaintenanceRequestList(requests) {
  if (!Array.isArray(requests) || requests.some((request) => (
    !request || typeof request !== "object" || Array.isArray(request)
    || !Number.isInteger(request.id) || !Number.isInteger(request.room_id)
    || typeof request.room_code !== "string"
    || (request.is_demo !== undefined && typeof request.is_demo !== "boolean")
    || !nullableText(request.room_name) || !nullableText(request.building_code)
    || !nullableText(request.building_name) || !nullableText(request.reporter_name)
    || !(request.reported_by === null || Number.isInteger(request.reported_by))
    || typeof request.title !== "string" || !nullableText(request.description)
    || !priorities.has(request.priority) || !statuses.has(request.status)
    || !nullableText(request.created_at) || !nullableText(request.resolved_at)
  ))) {
    throw new Error("The maintenance API returned an unexpected response.");
  }
  return requests;
}

export function validateMaintenanceRequest(request) {
  return validateMaintenanceRequestList([request])[0];
}
