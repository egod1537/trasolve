import type { GeoPoint } from '@/shared/types/mapTypes';

export type MapTool = 'pan' | 'distance' | 'area';
const radius = 6371008.8;
const radians = (value: number) => (value * Math.PI) / 180;
const longitudeDelta = (value: number) => ((value + 540) % 360) - 180;

export function segmentDistance(a: GeoPoint, b: GeoPoint): number {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(longitudeDelta(b.lng - a.lng));
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

// Spherical ring area, using wrapped longitude deltas across the date line.
export function polygonArea(points: readonly GeoPoint[]): number {
  if (points.length < 3) {
    return 0;
  }
  let sum = 0;
  points.forEach((point, i) => {
    const next = points[(i + 1) % points.length];
    sum +=
      radians(longitudeDelta(next.lng - point.lng)) *
      (2 + Math.sin(radians(point.lat)) + Math.sin(radians(next.lat)));
  });
  const surface = 4 * Math.PI * radius ** 2;
  const area = Math.abs((sum * radius ** 2) / 2) % surface;
  return Math.min(area, surface - area);
}

export function isSimplePolygon(points: readonly GeoPoint[]): boolean {
  if (points.length < 3) {
    return true;
  }
  const origin = points[0].lng;
  const flat = points.map((p) => ({
    x: longitudeDelta(p.lng - origin),
    y: p.lat,
  }));
  const cross = (a: (typeof flat)[number], b: typeof a, c: typeof a) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (j === i + 1 || (i === 0 && j === flat.length - 1)) {
        continue;
      }
      const a = flat[i],
        b = flat[(i + 1) % flat.length],
        c = flat[j],
        d = flat[(j + 1) % flat.length];
      if (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0 &&
        Math.max(a.x, b.x) >= Math.min(c.x, d.x) &&
        Math.max(c.x, d.x) >= Math.min(a.x, b.x) &&
        Math.max(a.y, b.y) >= Math.min(c.y, d.y) &&
        Math.max(c.y, d.y) >= Math.min(a.y, b.y)
      ) {
        return false;
      }
    }
  }
  return true;
}
