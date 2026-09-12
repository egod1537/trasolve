import type { GeoPoint } from '../../../map/types/mapTypes';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculatePolylineDistanceMeters(
  path: readonly GeoPoint[],
): number | undefined {
  if (path.length < 2) return undefined;

  let distance = 0;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    const latitudeDelta = toRadians(current.lat - previous.lat);
    const longitudeDelta = toRadians(current.lng - previous.lng);
    const previousLatitude = toRadians(previous.lat);
    const currentLatitude = toRadians(current.lat);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(previousLatitude) *
        Math.cos(currentLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;
    distance +=
      2 *
      EARTH_RADIUS_METERS *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }
  return distance;
}

export function formatPolylineDistance(distanceMeters: number | undefined) {
  if (distanceMeters === undefined) return '경로 정보 없음';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  const kilometers = distanceMeters / 1000;
  return `${kilometers < 10 ? kilometers.toFixed(1) : Math.round(kilometers)} km`;
}
