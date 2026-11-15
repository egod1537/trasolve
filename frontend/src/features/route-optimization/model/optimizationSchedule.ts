import {
  type TrouteOptimizeResponse,
  type TrouteSolverCandidate,
  type TripDay,
  type TripScheduleUpdate,
} from '@trasolve/shared';
import {
  type RouteOptimizationRequestOptions,
  type RouteOptimizationScheduleStop,
  type RouteOptimizationSchedule,
} from '@/features/route-optimization/model/routeOptimizationTypes';
import { getOptimizationStayMinutes } from '@/features/route-optimization/model/optimizationConstraints';
import {
  resolveServiceStartTime,
  addClockMinutes,
  getForwardMinutes,
} from '@/features/route-optimization/model/optimizationClock';

export function getBestOptimizationCandidate(
  response: TrouteOptimizeResponse,
): TrouteSolverCandidate {
  const selectedBest = response.solver_candidates?.find(
    (candidate) => candidate.best,
  );
  if (selectedBest) {
    return selectedBest;
  }
  const route = [...response.route].sort(
    (left, right) => left.order - right.order,
  );
  return {
    strategy: 'best',
    best: true,
    route: route.map((stop) => stop.location_id),
    feasible: true,
    elapsed_ms: 0,
    metadata: { timed_out: false },
  };
}

export function createRouteOptimizationSchedule(
  response: TrouteOptimizeResponse,
  candidate: TrouteSolverCandidate,
  activeDay: TripDay,
): RouteOptimizationSchedule | null {
  const route = [...response.route].sort(
    (left, right) => left.order - right.order,
  );
  if (
    route.length !== candidate.route.length ||
    route.some((stop, index) => stop.location_id !== candidate.route[index])
  ) {
    return null;
  }

  const placesById = new Map(
    activeDay.places.map((place) => [place.id, place]),
  );
  const stops: RouteOptimizationScheduleStop[] = [];
  for (const [index, stop] of route.entries()) {
    const place = placesById.get(stop.location_id);
    if (!place) {
      return null;
    }
    const requestedStayMinutes =
      stop.stay_minutes ?? getOptimizationStayMinutes(place);
    const serviceStartTime = resolveServiceStartTime(
      stop.arrival_time,
      stop.service_start_time,
      stop.departure_time,
      stop.wait_minutes,
      requestedStayMinutes,
    );
    if (!serviceStartTime) {
      return null;
    }
    const departureTime =
      stop.departure_time ??
      addClockMinutes(serviceStartTime, requestedStayMinutes);
    if (!departureTime) {
      return null;
    }
    const scheduledWaitMinutes = getForwardMinutes(
      stop.arrival_time,
      serviceStartTime,
    );
    const scheduledStayMinutes = getForwardMinutes(
      serviceStartTime,
      departureTime,
    );
    if (scheduledWaitMinutes === null || scheduledStayMinutes === null) {
      return null;
    }
    const waitMinutes = stop.wait_minutes ?? scheduledWaitMinutes;
    const stayMinutes = stop.stay_minutes ?? scheduledStayMinutes;
    const previousDeparture = stops.at(-1)?.departureTime;
    const travelMinutesFromPrevious = previousDeparture
      ? getForwardMinutes(previousDeparture, stop.arrival_time)
      : null;
    if (index > 0 && travelMinutesFromPrevious === null) {
      return null;
    }
    stops.push({
      placeId: stop.location_id,
      arrivalTime: stop.arrival_time,
      serviceStartTime,
      departureTime,
      travelMinutesFromPrevious,
      waitMinutes,
      stayMinutes,
      syncStayMinutes: stop.stay_minutes !== undefined,
    });
  }
  return { placeIds: candidate.route, stops };
}

export function createTripScheduleUpdate(
  schedule: RouteOptimizationSchedule,
  selectedStartPlaceId: string,
  selectedEndPlaceId: string,
  skippedPlaceIds: readonly string[] = [],
): TripScheduleUpdate {
  return {
    placeIds: schedule.placeIds,
    stops: schedule.stops.map((stop) => ({
      placeId: stop.placeId,
      time: stop.serviceStartTime,
      ...(stop.syncStayMinutes
        ? { visitDurationMinutes: stop.stayMinutes }
        : {}),
    })),
    expectedStartPlaceId: selectedStartPlaceId,
    expectedEndPlaceId: selectedEndPlaceId,
    ...(skippedPlaceIds.length > 0 ? { skippedPlaceIds } : {}),
  };
}

export function isApplicableCandidate(
  candidate: TrouteSolverCandidate | null,
  activeDay: TripDay,
  options?: Pick<
    RouteOptimizationRequestOptions,
    | 'selectedStartPlaceId'
    | 'selectedEndPlaceId'
    | 'visitPolicy'
    | 'placePreferences'
  >,
): candidate is TrouteSolverCandidate {
  if (
    !candidate?.feasible ||
    candidate.metadata.error ||
    isTimedOut(candidate)
  ) {
    return false;
  }
  const currentIds = new Set(activeDay.places.map((place) => place.id));
  const orderedPlaces = [...activeDay.places].sort(
    (left, right) => left.order - right.order,
  );
  const selectedStartPlaceId =
    options?.selectedStartPlaceId ?? orderedPlaces[0]?.id;
  const selectedEndPlaceId =
    options?.selectedEndPlaceId ?? orderedPlaces.at(-1)?.id;
  if (!selectedStartPlaceId || !selectedEndPlaceId) {
    return false;
  }
  const partial = options?.visitPolicy === 'best-effort-on-failure';
  const requiredIds = new Set([
    selectedStartPlaceId,
    selectedEndPlaceId,
    ...Object.entries(options?.placePreferences ?? {})
      .filter(([, preference]) => preference.required)
      .map(([placeId]) => placeId),
  ]);
  return (
    (partial
      ? candidate.route.length >= 2 &&
        [...requiredIds].every((placeId) => candidate.route.includes(placeId))
      : candidate.route.length === currentIds.size) &&
    new Set(candidate.route).size === candidate.route.length &&
    candidate.route.every((placeId) => currentIds.has(placeId)) &&
    candidate.route[0] === selectedStartPlaceId &&
    candidate.route.at(-1) === selectedEndPlaceId
  );
}

export function isTimedOut(candidate: TrouteSolverCandidate): boolean {
  return candidate.metadata?.timed_out === true;
}
