import type { TripPlace } from '@trasolve/shared';
import { calculatePolylineDistanceMeters } from '@/shared/lib/geoDistance';
import {
  getComparisonPlaces,
  type RouteComparisonData,
} from './routeComparison';

function clockMinutes(time: string | undefined): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function betweenPlaceMinutes(places: readonly TripPlace[]): number | null {
  let total = 0;
  for (let index = 1; index < places.length; index++) {
    const previous = places[index - 1]!;
    const start = clockMinutes(previous.time);
    const end = clockMinutes(places[index]!.time);
    const stay =
      previous.preferredDurationMinutes ?? previous.visitDurationMinutes;
    if (
      start === null ||
      end === null ||
      stay === undefined ||
      !Number.isFinite(stay) ||
      stay < 0 ||
      end < start + stay
    ) {
      return null;
    }
    total += end - start - stay;
  }
  return total;
}

export function getRouteComparisonMetrics(data: RouteComparisonData) {
  const before = getComparisonPlaces(data, 'current');
  const after = getComparisonPlaces(data, 'result');
  const beforeIds = new Set(before.map((place) => place.id));
  const hasResult = data.live?.hasResult !== false;
  const comparable =
    hasResult &&
    before.length === after.length &&
    after.every((place) => beforeIds.has(place.id));
  const beforeMinutes = betweenPlaceMinutes(before);
  const afterMinutes = hasResult ? betweenPlaceMinutes(after) : null;
  const beforeMeters =
    before.length < 2
      ? 0
      : (calculatePolylineDistanceMeters(
          before.map((place) => place.location),
        ) ?? null);
  const afterMeters = !hasResult
    ? null
    : after.length < 2
      ? 0
      : (calculatePolylineDistanceMeters(
          after.map((place) => place.location),
        ) ?? null);
  return {
    beforeMinutes,
    afterMinutes,
    beforeMeters,
    afterMeters,
    minutesSaved:
      comparable && beforeMinutes !== null && afterMinutes !== null
        ? beforeMinutes - afterMinutes
        : null,
    metersSaved:
      comparable && beforeMeters !== null && afterMeters !== null
        ? beforeMeters - afterMeters
        : null,
  };
}

/** Geometric change between displayed orders of the same stops, including illustrations. */
export function getRouteDistanceChange(
  before: RouteComparisonData,
  after: RouteComparisonData,
): number | null {
  if (
    before.day !== after.day ||
    after.live?.status === 'failed' ||
    after.live?.status === 'cancelled' ||
    after.live?.status === 'cancelling'
  ) {
    return null;
  }
  const previous = before.update.placeIds;
  const next = after.update.placeIds;
  if (
    previous.length !== next.length ||
    previous.every((id, index) => id === next[index])
  ) {
    return null;
  }
  const previousIds = new Set(previous);
  if (!next.every((id) => previousIds.has(id))) {
    return null;
  }
  const places = new Map(
    after.day.places.map((place) => [place.id, place.location]),
  );
  const distance = (ids: readonly string[]) => {
    const points = ids.flatMap((id) => {
      const point = places.get(id);
      return point ? [point] : [];
    });
    return points.length === ids.length
      ? calculatePolylineDistanceMeters(points)
      : undefined;
  };
  const previousMeters = distance(previous);
  const nextMeters = distance(next);
  return previousMeters === undefined || nextMeters === undefined
    ? null
    : previousMeters - nextMeters;
}
