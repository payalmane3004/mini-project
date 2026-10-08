import footprintData from "../../data/wce-campus-footprints.json";

const points = footprintData.footprints.flatMap((footprint) => footprint.polygon);
const xs = points.map(([x]) => x);
const ys = points.map(([, y]) => y);

export const campusCadBounds = {
  minX: Math.min(...xs),
  maxX: Math.max(...xs),
  minY: Math.min(...ys),
  maxY: Math.max(...ys),
};

export const CAMPUS_TARGET_WIDTH = 72;
export const campusCadScale =
  CAMPUS_TARGET_WIDTH / (campusCadBounds.maxX - campusCadBounds.minX);

export function normalizeCadPoint(x, y) {
  const { minX, maxX, minY, maxY } = campusCadBounds;
  const width = maxX - minX;
  const height = maxY - minY;

  return [
    (x - minX - width / 2) * campusCadScale,
    (y - minY - height / 2) * campusCadScale,
  ];
}
