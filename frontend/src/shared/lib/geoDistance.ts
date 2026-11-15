import type { GeoPoint } from '@/shared/types/mapTypes';

const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function calculatePolylineDistanceMeters(
  path: readonly GeoPoint[],
): number | undefined {
  if (path.length < 2) {
    return undefined;
  }
  let distance = 0;
  for (let index = 1; index < path.length; index++) {
    const previous = path[index - 1]!;
    const current = path[index]!;
    const value =
      Math.sin(toRadians(current.lat - previous.lat) / 2) ** 2 +
      Math.cos(toRadians(previous.lat)) *
        Math.cos(toRadians(current.lat)) *
        Math.sin(toRadians(current.lng - previous.lng) / 2) ** 2;
    const haversine = Math.max(0, Math.min(1, value));
    distance +=
      2 *
      EARTH_RADIUS_METERS *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }
  return distance;
}
