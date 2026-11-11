import type { TripDay, RouteValidationRequest } from '@trasolve/shared';
import {
  getRouteOptimizationIssue,
  type RouteOptimizationIssue,
  type RouteOptimizationRequestOptions,
} from './routeOptimization';
import { getLocationConstraint } from './optimizationConstraints';
import { addClockMinutes, clockToMinutes } from './optimizationClock';

export type LocalValidationIssue = {
  id: string;
  issue: RouteOptimizationIssue;
};

export function prepareRouteValidation(
  day: TripDay,
  settings: RouteOptimizationRequestOptions,
): {
  issues: LocalValidationIssue[];
  request: RouteValidationRequest | null;
  unknownHours: string[];
} {
  const places = [...day.places].sort((a, b) => a.order - b.order);
  const constraints = places.map((place) => getLocationConstraint(day, place));
  const issues = constraints.flatMap((constraint, index) =>
    constraint.issue
      ? [{ id: places[index]!.id, issue: constraint.issue }]
      : [],
  );
  const firstIssue = getRouteOptimizationIssue(day, settings);
  if (
    firstIssue &&
    !issues.some(
      (item) => JSON.stringify(item.issue) === JSON.stringify(firstIssue),
    )
  ) {
    issues.unshift({ id: day.id, issue: firstIssue });
  }
  const unknownHours = places
    .filter((_, index) => constraints[index]!.usedOpeningHoursFallback)
    .map((place) => place.name);
  if (issues.length || places.length < 2) {
    return { issues, request: null, unknownHours };
  }
  const first = places[0]!;
  const start =
    settings.startPolicy === 'fixed'
      ? settings.startTime!
      : (first.time ?? constraints[0]!.openTime);
  // Solver-generated service times use minute precision. Keep the requested
  // service time intact while the route's arrival/start uses the API's grid.
  const arrivalStart = addClockMinutes(start, -(clockToMinutes(start) % 10))!;
  const serviceTimes = Object.fromEntries(
    places
      .filter((place) => place.time !== null)
      .map((place) => [place.id, place.time!]),
  );
  if (settings.startPolicy === 'fixed') {
    serviceTimes[first.id] = start;
  }
  return {
    issues,
    unknownHours,
    request: {
      route: {
        job_id: `validate-${day.id.slice(0, 80)}`,
        locations: places.map((place, index) => ({
          id: place.id,
          name: place.name,
          place_id: place.placeId ?? '',
          latitude: place.location.lat,
          longitude: place.location.lng,
          open_time: constraints[index]!.openTime,
          close_time: constraints[index]!.closeTime,
          stay_minutes: constraints[index]!.stayMinutes,
          ...(place.orderLocked ? { order_locked: true } : {}),
        })),
        start_policy: 'FIXED',
        start_time: arrivalStart,
        travel_mode: settings.travelMode,
        use_euclidean_matrix: true,
      },
      service_start_times: serviceTimes,
    },
  };
}
