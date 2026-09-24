import {
  trouteOptimizeRequestSchema,
  trouteTravelModeSchema,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
  type TrouteSolverCandidate,
  type TrouteTravelMode,
  type TripDay,
  type TripPlace,
} from '@trasolve/shared';
import { getPlaceOpeningStatus } from '@/entities/place';

type RouteOptimizationDay = TripDay & {
  minimumStartTime?: string;
  startTime?: string;
  travelMode?: string;
};

const DEFAULT_START_TIME = '09:00';
const DEFAULT_TRAVEL_MODE: TrouteTravelMode = 'TRANSIT';
const FALLBACK_OPEN_TIME = '00:00';
const FALLBACK_CLOSE_TIME = '23:50';
const MINUTES_PER_DAY = 24 * 60;
const TROUTE_TIME_STEP_MINUTES = 10;
const TRAVEL_MODE_BY_POLYLINE_MODE = {
  walking: 'WALKING',
  transit: 'TRANSIT',
  driving: 'DRIVING',
} as const satisfies Record<string, TrouteTravelMode>;

type LocationConstraint = {
  openTime: string;
  closeTime: string;
  stayMinutes: number;
  usedOpeningHoursFallback: boolean;
  issue: string | null;
};

export type RouteOptimizationDiagnostics = {
  openingHoursFallback: boolean;
  openingHoursFallbackPlaceIds: readonly string[];
  openingHoursFallbackPlaceNames: readonly string[];
};

export function getRouteOptimizationIssue(
  activeDay: RouteOptimizationDay,
): string | null {
  const orderedPlaces = getOrderedPlaces(activeDay);
  if (orderedPlaces.length < 2) {
    return '경로 최적화에는 2개 이상의 장소가 필요합니다.';
  }
  const missingPlaceIds = orderedPlaces.filter(
    (place) => !place.placeId?.trim(),
  );
  if (missingPlaceIds.length > 0) {
    return `실제 이동시간 조회에 Place ID가 필요합니다: ${missingPlaceIds
      .map((place) => place.name)
      .join(', ')}`;
  }
  const startTime = resolveMinimumStartTime(activeDay, orderedPlaces);
  if (!isClockTime(startTime)) {
    return '최소 출발 가능 시각을 HH:mm 형식으로 입력해 주세요.';
  }
  const travelMode = resolveTravelMode(activeDay);
  if (!trouteTravelModeSchema.safeParse(travelMode).success) {
    return `지원하지 않는 이동수단입니다: ${String(travelMode)}`;
  }
  for (const place of orderedPlaces) {
    const constraint = getLocationConstraint(activeDay, place);
    if (constraint.issue) {
      return constraint.issue;
    }
  }
  return null;
}

export function createRouteOptimizationRequest(
  activeDay: RouteOptimizationDay,
  travelMode: TrouteTravelMode = getRouteOptimizationTravelMode(activeDay),
): TrouteOptimizeRequest {
  const issue = getRouteOptimizationIssue(activeDay);
  if (issue) {
    throw new Error(issue);
  }
  const orderedPlaces = getOrderedPlaces(activeDay);
  const constraints = orderedPlaces.map((place) =>
    getLocationConstraint(activeDay, place),
  );
  const request = {
    job_id: createRouteOptimizationJobId(activeDay.id),
    locations: orderedPlaces.map((place, index) => {
      const constraint = constraints[index]!;
      return {
        id: place.id.trim(),
        place_id: place.placeId!.trim(),
        open_time: constraint.openTime,
        close_time: constraint.closeTime,
        stay_minutes: constraint.stayMinutes,
      };
    }),
    start_time: resolveMinimumStartTime(activeDay, orderedPlaces),
    travel_mode: travelMode,
  };
  try {
    return trouteOptimizeRequestSchema.parse(request);
  } catch {
    throw new Error('경로 최적화 요청 값이 올바르지 않습니다.');
  }
}

export function getRouteOptimizationDiagnostics(
  activeDay: RouteOptimizationDay,
): RouteOptimizationDiagnostics {
  const fallbackPlaces = getOrderedPlaces(activeDay).filter(
    (place) => getLocationConstraint(activeDay, place).usedOpeningHoursFallback,
  );
  return {
    openingHoursFallback: fallbackPlaces.length > 0,
    openingHoursFallbackPlaceIds: fallbackPlaces.map((place) => place.id),
    openingHoursFallbackPlaceNames: fallbackPlaces.map((place) => place.name),
  };
}

export function getRouteOptimizationTravelMode(
  activeDay: RouteOptimizationDay,
): TrouteTravelMode {
  const parsed = trouteTravelModeSchema.safeParse(resolveTravelMode(activeDay));
  return parsed.success ? parsed.data : DEFAULT_TRAVEL_MODE;
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
  travelMode: TrouteTravelMode,
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
            getPolylineTravelMode(polyline.mode) === travelMode &&
            polyline.path &&
            polyline.path.length >= 2,
        )?.path,
    );
  if (paths.some((path) => !path)) {
    return undefined;
  }
  return paths.flatMap((path, index) => (index === 0 ? path! : path!.slice(1)));
}

function getPolylineTravelMode(
  mode: TripDay['polylines'][number]['mode'],
): TrouteTravelMode | null {
  return mode === 'straight' ? null : TRAVEL_MODE_BY_POLYLINE_MODE[mode];
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

function getLocationConstraint(
  activeDay: TripDay,
  place: TripPlace,
): LocationConstraint {
  const openingWindow = getOpeningWindow(
    place,
    getReferenceDate(activeDay, place),
  );
  const stayMinutes =
    place.visitDurationMinutes ?? place.preferredDurationMinutes ?? 0;
  const stayIssue = isTenMinuteStep(stayMinutes)
    ? null
    : `${place.name}의 체류시간은 10분 단위여야 합니다: ${stayMinutes}분`;
  return {
    ...openingWindow,
    stayMinutes,
    issue: openingWindow.issue ?? stayIssue,
  };
}

function getOpeningWindow(
  place: TripPlace,
  referenceDate: Date,
): Omit<LocationConstraint, 'stayMinutes'> {
  const status = getPlaceOpeningStatus(place.openingHours, referenceDate);
  if (status.type === 'unknown') {
    return {
      openTime: FALLBACK_OPEN_TIME,
      closeTime: FALLBACK_CLOSE_TIME,
      usedOpeningHoursFallback: true,
      issue: null,
    };
  }
  if (status.type === 'always-open') {
    return {
      openTime: FALLBACK_OPEN_TIME,
      closeTime: FALLBACK_CLOSE_TIME,
      usedOpeningHoursFallback: false,
      issue: null,
    };
  }
  if (
    status.timelineRanges.some(
      (range) => range.start < 0 || range.end >= MINUTES_PER_DAY,
    )
  ) {
    return invalidOpeningWindow(
      `${place.name}의 익일 영업시간은 현재 경로 최적화에서 지원하지 않습니다.`,
    );
  }

  const ranges = status.timelineRanges.filter(
    (range) =>
      range.start >= 0 &&
      range.end <= MINUTES_PER_DAY &&
      range.start < range.end &&
      isClockTime(range.startText) &&
      isClockTime(range.endText),
  );
  if (ranges.length === 0) {
    return invalidOpeningWindow(
      `${place.name}은 선택한 날짜에 유효한 영업시간이 없습니다.`,
    );
  }

  const scheduledMinutes = place.time ? clockToMinutes(place.time) : undefined;
  const range =
    ranges.find(
      (candidate) =>
        scheduledMinutes !== undefined &&
        candidate.start <= scheduledMinutes &&
        scheduledMinutes <= candidate.end,
    ) ?? ranges[0]!;
  if (!isTenMinuteClock(range.startText)) {
    return invalidOpeningWindow(
      `${place.name}의 영업 시작 시각은 10분 단위여야 합니다: ${range.startText}`,
    );
  }
  if (!isTenMinuteClock(range.endText)) {
    return invalidOpeningWindow(
      `${place.name}의 영업 종료 시각은 10분 단위여야 합니다: ${range.endText}`,
    );
  }
  return {
    openTime: range.startText,
    closeTime: range.endText,
    usedOpeningHoursFallback: false,
    issue: null,
  };
}

function invalidOpeningWindow(
  issue: string,
): Omit<LocationConstraint, 'stayMinutes'> {
  return {
    openTime: FALLBACK_OPEN_TIME,
    closeTime: FALLBACK_CLOSE_TIME,
    usedOpeningHoursFallback: false,
    issue,
  };
}

function getOrderedPlaces(activeDay: TripDay): TripPlace[] {
  return [...activeDay.places].sort((left, right) => left.order - right.order);
}

function getReferenceDate(activeDay: TripDay, place: TripPlace): Date {
  if (!activeDay.date) {
    return new Date();
  }
  const [year, month, day] = activeDay.date.split('-').map(Number);
  const utcNoon = Date.UTC(year!, month! - 1, day!, 12);
  const offsetMinutes = place.openingHours?.utcOffsetMinutes;
  return offsetMinutes === undefined
    ? new Date(`${activeDay.date}T12:00:00`)
    : new Date(utcNoon - offsetMinutes * 60_000);
}

function resolveMinimumStartTime(
  activeDay: RouteOptimizationDay,
  orderedPlaces: readonly TripPlace[],
): string {
  return (
    activeDay.minimumStartTime ??
    activeDay.startTime ??
    orderedPlaces[0]?.time ??
    DEFAULT_START_TIME
  );
}

function resolveTravelMode(
  activeDay: RouteOptimizationDay,
): TrouteTravelMode | string {
  if (activeDay.travelMode !== undefined) {
    return activeDay.travelMode.trim().toUpperCase();
  }
  const routeModes = new Set<TrouteTravelMode>();
  for (const polyline of activeDay.polylines) {
    if (polyline.mode === 'straight') {
      continue;
    }
    routeModes.add(TRAVEL_MODE_BY_POLYLINE_MODE[polyline.mode]);
  }
  return routeModes.size === 1
    ? (routeModes.values().next().value ?? DEFAULT_TRAVEL_MODE)
    : DEFAULT_TRAVEL_MODE;
}

function createRouteOptimizationJobId(dayId: string): string {
  const dayIdSegment = dayId.slice(0, 50);
  return `route-${dayIdSegment}-${Date.now()}-${crypto.randomUUID()}`;
}

function isClockTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isTenMinuteClock(value: string): boolean {
  return isClockTime(value) && isTenMinuteStep(clockToMinutes(value));
}

function isTenMinuteStep(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= 0 &&
    minutes % TROUTE_TIME_STEP_MINUTES === 0
  );
}

function clockToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
