import type { Trip } from '@trasolve/shared';

export type TripPreviewPoint = { x: number; y: number };

export type TripPreviewRoute = {
  dayId: string;
  color: string;
  points: readonly TripPreviewPoint[];
};

/** Provider-neutral preview geometry; renderers only draw it. */
export type TripPreviewModel =
  | { status: 'empty' }
  | {
      status: 'ready';
      width: number;
      height: number;
      routes: readonly TripPreviewRoute[];
    };

export type TripPreviewViewportOptions = {
  width: number;
  height: number;
  padding: number;
};

/**
 * Smallest area the preview shows, in degrees. A single place (or places in
 * one building) gets roughly a neighbourhood-sized frame instead of a point.
 */
const MIN_SPAN_DEGREES = 0.02;
const MAX_MERCATOR_LATITUDE = 85;

/** Web Mercator y in degree-like units, so it scales like longitude. */
function toMercatorY(lat: number): number {
  const clamped = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, lat),
  );
  const radians = (clamped * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + radians / 2)) * 180) / Math.PI;
}

function isFiniteLocation(location: { lat: number; lng: number }): boolean {
  return Number.isFinite(location.lat) && Number.isFinite(location.lng);
}

/**
 * Fits every place of the Trip into the preview frame, keeping the map
 * aspect ratio and centering the bounds. Routes crossing the antimeridian
 * are unwrapped so they are not stretched across the whole world.
 */
export function createTripPreviewModel(
  trip: Pick<Trip, 'days'>,
  { width, height, padding }: TripPreviewViewportOptions,
): TripPreviewModel {
  const days = trip.days
    .map((day) => ({
      dayId: day.id,
      color: day.color,
      locations: [...day.places]
        .sort((a, b) => a.order - b.order)
        .map((place) => place.location)
        .filter(isFiniteLocation),
    }))
    .filter((day) => day.locations.length > 0);
  const locations = days.flatMap((day) => day.locations);
  if (locations.length === 0) {
    return { status: 'empty' };
  }

  const rawLngs = locations.map((location) => location.lng);
  const crossesAntimeridian = Math.max(...rawLngs) - Math.min(...rawLngs) > 180;
  const toX = (lng: number) =>
    crossesAntimeridian && lng < 0 ? lng + 360 : lng;

  const xs = locations.map((location) => toX(location.lng));
  const ys = locations.map((location) => toMercatorY(location.lat));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, MIN_SPAN_DEGREES);
  const spanY = Math.max(maxY - minY, MIN_SPAN_DEGREES);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY,
  );

  const project = (location: {
    lat: number;
    lng: number;
  }): TripPreviewPoint => ({
    x: width / 2 + (toX(location.lng) - centerX) * scale,
    // Latitude grows northward while SVG y grows downward.
    y: height / 2 - (toMercatorY(location.lat) - centerY) * scale,
  });

  return {
    status: 'ready',
    width,
    height,
    routes: days.map((day) => ({
      dayId: day.dayId,
      color: day.color,
      points: day.locations.map(project),
    })),
  };
}
