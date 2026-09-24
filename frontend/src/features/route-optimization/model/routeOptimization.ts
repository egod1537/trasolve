import {
  trouteOptimizeRequestSchema,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
  type TrouteSolverCandidate,
  type TripDay,
  type TripPlace,
} from '@trasolve/shared';
import { getPlaceOpeningStatus } from '@/entities/place';

export function getRouteOptimizationIssue(activeDay: TripDay): string | null {
  if (activeDay.places.length < 2) {
    return '경로 최적화에는 2개 이상의 장소가 필요합니다.';
  }
  const missingPlaceIds = activeDay.places.filter(
    (place) => !place.placeId?.trim(),
  );
  if (missingPlaceIds.length > 0) {
    return `실제 이동시간 조회에 Place ID가 필요합니다: ${missingPlaceIds
      .map((place) => place.name)
      .join(', ')}`;
  }
  return null;
}

export function createRouteOptimizationRequest(
  activeDay: TripDay,
): TrouteOptimizeRequest {
  const issue = getRouteOptimizationIssue(activeDay);
  if (issue) {
    throw new Error(issue);
  }
  const referenceDate = activeDay.date
    ? new Date(`${activeDay.date}T12:00:00`)
    : new Date();
  return trouteOptimizeRequestSchema.parse({
    job_id: `route-${Date.now()}-${crypto.randomUUID().slice(0, 12)}`,
    locations: activeDay.places.map((place) => {
      const openingWindow = getOpeningWindow(place, referenceDate);
      return {
        id: place.id,
        place_id: place.placeId,
        open_time: openingWindow.openTime,
        close_time: openingWindow.closeTime,
        stay_minutes:
          place.visitDurationMinutes ?? place.preferredDurationMinutes ?? 0,
      };
    }),
    start_time: activeDay.places[0]?.time ?? '09:00',
    travel_mode: 'TRANSIT',
  });
}

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
    objective_score: {
      latest_start:
        route[0]?.departure_time ?? route[0]?.arrival_time ?? '00:00',
      finish_time:
        route.at(-1)?.departure_time ?? route.at(-1)?.arrival_time ?? '00:00',
      travel_minutes: response.total_travel_minutes,
      wait_minutes: 0,
    },
  };
}

export function getCurrentDayRoutePath(
  activeDay: TripDay,
): readonly { lat: number; lng: number }[] | undefined {
  const places = [...activeDay.places].sort(
    (left, right) => left.order - right.order,
  );
  if (places.length < 2) {
    return undefined;
  }
  const paths = places
    .slice(0, -1)
    .map(
      (place, index) =>
        activeDay.polylines.find(
          (polyline) =>
            polyline.fromPlaceId === place.id &&
            polyline.toPlaceId === places[index + 1]!.id &&
            polyline.path &&
            polyline.path.length >= 2,
        )?.path,
    );
  if (paths.some((path) => !path)) {
    return undefined;
  }
  return paths.flatMap((path, index) => (index === 0 ? path! : path!.slice(1)));
}

export function isApplicableCandidate(
  candidate: TrouteSolverCandidate | null,
  activeDay: TripDay,
): candidate is TrouteSolverCandidate {
  if (!candidate?.feasible || candidate.error || isTimedOut(candidate)) {
    return false;
  }
  const currentIds = new Set(activeDay.places.map((place) => place.id));
  const orderedPlaces = [...activeDay.places].sort(
    (left, right) => left.order - right.order,
  );
  return (
    candidate.route.length === currentIds.size &&
    new Set(candidate.route).size === currentIds.size &&
    candidate.route.every((placeId) => currentIds.has(placeId)) &&
    candidate.route[0] === orderedPlaces[0]?.id &&
    candidate.route.at(-1) === orderedPlaces.at(-1)?.id
  );
}

export function isTimedOut(candidate: TrouteSolverCandidate): boolean {
  return candidate.metadata?.timed_out === true;
}

function getOpeningWindow(
  place: TripPlace,
  referenceDate: Date,
): { openTime: string; closeTime: string } {
  const ranges = getPlaceOpeningStatus(
    place.openingHours,
    referenceDate,
  ).timelineRanges.filter(
    (range) =>
      range.start >= 0 &&
      range.end <= 24 * 60 - 1 &&
      isClockTime(range.startText) &&
      isClockTime(range.endText) &&
      range.startText <= range.endText,
  );
  if (ranges.length > 0) {
    const scheduledMinutes = place.time
      ? clockToMinutes(place.time)
      : undefined;
    const range =
      ranges.find(
        (candidate) =>
          scheduledMinutes !== undefined &&
          candidate.start <= scheduledMinutes &&
          scheduledMinutes <= candidate.end,
      ) ?? ranges[0]!;
    return {
      openTime: range.startText,
      closeTime: range.endText,
    };
  }
  return {
    openTime: place.time ?? '00:00',
    closeTime: '23:59',
  };
}

function isClockTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function clockToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
