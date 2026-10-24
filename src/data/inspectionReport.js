export function validateInspectionReport(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Inspection report must be an object");
  if (!Array.isArray(value.sourceText) || !value.sourceText.every((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry) && typeof entry.text === "string"
  )) throw new TypeError("Inspection report sourceText must contain text entries");
  if (!Number.isFinite(value.modelSpaceEntityCount) || value.modelSpaceEntityCount < 0) throw new TypeError("Inspection report modelSpaceEntityCount is invalid");
  if (value.rendererRenderedEntityCounts != null &&
      (!value.rendererRenderedEntityCounts || typeof value.rendererRenderedEntityCounts !== "object" || Array.isArray(value.rendererRenderedEntityCounts) ||
       Object.values(value.rendererRenderedEntityCounts).some((count) => !Number.isFinite(count) || count < 0))) {
    throw new TypeError("Inspection report renderer counts are invalid");
  }
  if (value.rendererRenderedEntityCounts == null &&
      (!Array.isArray(value.rendererSupportedEntities) || !value.rendererSupportedEntities.every((type) => typeof type === "string") ||
       !value.entityCounts || typeof value.entityCounts !== "object" || Array.isArray(value.entityCounts))) {
    throw new TypeError("Inspection report renderer entity data is invalid");
  }
  return value;
}
