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
  const comparable =
    before.length === after.length &&
    after.every((place) => beforeIds.has(place.id));
  const beforeMinutes = betweenPlaceMinutes(before);
  const afterMinutes = betweenPlaceMinutes(after);
  const beforeMeters =
    before.length < 2
      ? 0
      : (calculatePolylineDistanceMeters(
          before.map((place) => place.location),
        ) ?? null);
  const afterMeters =
    after.length < 2
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
