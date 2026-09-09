import type { GeoBounds, GeoPoint } from '../types/mapTypes';

const minimumLongitude = -180;
const maximumLongitude = 180;

function normalizeLongitude(longitude: number): number {
  const worldWidth = maximumLongitude - minimumLongitude;
  return (
    ((((longitude - minimumLongitude) % worldWidth) + worldWidth) %
      worldWidth) +
    minimumLongitude
  );
}

export function expandBounds(bounds: GeoBounds, ratio: number): GeoBounds {
  const safeRatio = Math.max(0, ratio);
  const latitudeSpan = bounds.north - bounds.south;
  const longitudeSpan =
    bounds.west <= bounds.east
      ? bounds.east - bounds.west
      : maximumLongitude - bounds.west + (bounds.east - minimumLongitude);

  const north = Math.min(90, bounds.north + latitudeSpan * safeRatio);
  const south = Math.max(-90, bounds.south - latitudeSpan * safeRatio);

  if (longitudeSpan * (1 + safeRatio * 2) >= 360) {
    return {
      north,
      south,
      east: maximumLongitude,
      west: minimumLongitude,
    };
  }

  return {
    north,
    south,
    east: normalizeLongitude(bounds.east + longitudeSpan * safeRatio),
    west: normalizeLongitude(bounds.west - longitudeSpan * safeRatio),
  };
}

export function containsPoint(bounds: GeoBounds, point: GeoPoint): boolean {
  const withinLatitude = point.lat >= bounds.south && point.lat <= bounds.north;
  const withinLongitude =
    bounds.west <= bounds.east
      ? point.lng >= bounds.west && point.lng <= bounds.east
      : point.lng >= bounds.west || point.lng <= bounds.east;

  return withinLatitude && withinLongitude;
}

export function isVisible(point: GeoPoint, bounds: GeoBounds): boolean {
  return containsPoint(bounds, point);
}
