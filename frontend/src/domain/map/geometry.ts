import type { GeoBounds, GeoPoint } from './mapTypes';

export function getGeoBounds(points: readonly GeoPoint[]): GeoBounds | null {
  if (!points.length) return null;

  let north = points[0].lat;
  let south = points[0].lat;
  let east = points[0].lng;
  let west = points[0].lng;

  for (const point of points.slice(1)) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }

  return { north, south, east, west };
}
