function insideBounds(point, bounds) {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= bounds.minX && point.x <= bounds.maxX
    && point.y >= bounds.minY && point.y <= bounds.maxY;
}

export function findSupportedFloorView(drawing, point) {
  const matches = (drawing.floorViews ?? []).filter((floor) => insideBounds(point, floor.bounds));
  return matches.length === 1 ? matches[0] : null;
}

export function normalizeCadAnnotation({ buildingId, drawing, annotation, sourceIndex }) {
  const x = Number.isFinite(annotation.x) ? annotation.x : annotation.dxfX;
  const y = Number.isFinite(annotation.y) ? annotation.y : annotation.dxfY;
  const floorView = findSupportedFloorView(drawing, { x, y });
  return {
    key: `${buildingId}-${sourceIndex}`,
    buildingId,
    buildingName: drawing.buildingName,
    text: annotation.text ?? annotation.originalCadText ?? "",
    sourceEntity: annotation.type ?? annotation.entityType ?? "CAD text",
    sourceLayer: annotation.layer ?? "unavailable",
    x,
    y,
    source: drawing.originalFilename ?? annotation.sourceDrawing,
    floorView,
    floor: floorView?.label ?? annotation.floor ?? null,
    verification: "Source annotation; room association unverified",
    route: `/building-explorer/${buildingId}?${floorView ? `floor=${encodeURIComponent(floorView.id)}&` : ""}annotation=${sourceIndex}`,
  };
}
