import {
  trouteOptimizeRequestSchema,
  trouteStartPolicySchema,
  trouteTravelModeSchema,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
  type TrouteSolverCandidate,
  type TrouteStartPolicy,
  type TrouteTravelMode,
  type TripDay,
  type TripPlace,
  type TripScheduleUpdate,
} from '@trasolve/shared';
import { getPlaceOpeningStatus } from '@/entities/place';

type RouteOptimizationDay = TripDay & {
  minimumStartTime?: string;
  startTime?: string;
  travelMode?: string;
};

export type RouteOptimizationStartPolicy = 'fixed' | 'earliest' | 'latest';

export type RouteOptimizationRequestOptions = {
  selectedStartPlaceId: string;
  selectedEndPlaceId: string;
  startPolicy: RouteOptimizationStartPolicy;
  startTime: string | null;
  travelMode: TrouteTravelMode;
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
const START_POLICY_BY_UI = {
  fixed: 'FIXED',
  earliest: 'EARLIEST',
  latest: 'LATEST',
} as const satisfies Record<RouteOptimizationStartPolicy, TrouteStartPolicy>;

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

export type RouteOptimizationScheduleStop = {
  placeId: string;
  arrivalTime: string;
  serviceStartTime: string;
  departureTime: string;
  travelMinutesFromPrevious: number | null;
  waitMinutes: number;
  stayMinutes: number;
  syncStayMinutes: boolean;
};

export type RouteOptimizationSchedule = {
  placeIds: readonly string[];
  stops: readonly RouteOptimizationScheduleStop[];
};

export function getRouteOptimizationIssue(
  activeDay: RouteOptimizationDay,
  options?: RouteOptimizationRequestOptions,
): string | null {
  const orderedPlaces = getOrderedPlaces(activeDay);
  if (orderedPlaces.length < 2) {
    return '경로 최적화에는 2개 이상의 장소가 필요합니다.';
  }
  const resolved = resolveRequestOptions(activeDay, orderedPlaces, options);
  const placeIds = new Set(orderedPlaces.map((place) => place.id));
  if (!placeIds.has(resolved.selectedStartPlaceId)) {
    return '시작점은 현재 Day에 포함된 장소여야 합니다.';
  }
  if (!placeIds.has(resolved.selectedEndPlaceId)) {
    return '종점은 현재 Day에 포함된 장소여야 합니다.';
  }
  if (resolved.selectedStartPlaceId === resolved.selectedEndPlaceId) {
    return '시작점과 종점은 서로 다른 장소여야 합니다.';
  }
  if (!trouteStartPolicySchema.safeParse(resolved.startPolicy).success) {
    return '지원하지 않는 시작 방식입니다.';
  }
  if (resolved.startPolicy === 'FIXED') {
    if (!resolved.startTime || !isClockTime(resolved.startTime)) {
      return '지정 시각 시작은 HH:mm 형식의 시작 시각이 필요합니다.';
    }
    if (!isTenMinuteClock(resolved.startTime)) {
      return '지정 시작 시각은 10분 단위여야 합니다.';
    }
  }
  const travelMode = resolved.travelMode;
  if (!trouteTravelModeSchema.safeParse(travelMode).success) {
    return `지원하지 않는 이동수단입니다: ${String(travelMode)}`;
  }
  const missingPlaceIds = orderedPlaces.filter(
    (place) => !place.placeId?.trim(),
  );
  if (missingPlaceIds.length > 0) {
    return `실제 이동시간 조회에 Place ID가 필요합니다: ${missingPlaceIds
      .map((place) => place.name)
      .join(', ')}`;
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
  options?: RouteOptimizationRequestOptions,
): TrouteOptimizeRequest {
  const issue = getRouteOptimizationIssue(activeDay, options);
  if (issue) {
    throw new Error(issue);
  }
  const orderedPlaces = getOrderedPlaces(activeDay);
  const resolved = resolveRequestOptions(activeDay, orderedPlaces, options);
  const requestPlaces = orderRouteOptimizationPlaces(activeDay, resolved);
  const constraints = requestPlaces.map((place) =>
    getLocationConstraint(activeDay, place),
  );
  const request = {
    job_id: createRouteOptimizationJobId(activeDay.id),
    locations: requestPlaces.map((place, index) => {
      const constraint = constraints[index]!;
      return {
        id: place.id.trim(),
        place_id: place.placeId!.trim(),
        open_time: constraint.openTime,
        close_time: constraint.closeTime,
        stay_minutes: constraint.stayMinutes,
      };
    }),
    start_policy: resolved.startPolicy,
    ...(resolved.startPolicy === 'FIXED'
      ? { start_time: resolved.startTime! }
      : {}),
    travel_mode: resolved.travelMode,
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
      stop.stay_minutes ??
      place.visitDurationMinutes ??
      place.preferredDurationMinutes ??
      0;
    const serviceStartTime = resolveServiceStartTime(
      stop.arrival_time,
      stop.service_start_time,
      stop.departure_time,
      stop.wait_minutes,
      requestedStayMinutes,
      index === 0,
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
  };
}

export function isApplicableCandidate(
  candidate: TrouteSolverCandidate | null,
  activeDay: TripDay,
  options?: Pick<
    RouteOptimizationRequestOptions,
    'selectedStartPlaceId' | 'selectedEndPlaceId'
  >,
): candidate is TrouteSolverCandidate {
  if (!candidate?.feasible || candidate.error || isTimedOut(candidate)) {
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
  return (
    candidate.route.length === currentIds.size &&
    new Set(candidate.route).size === currentIds.size &&
    candidate.route.every((placeId) => currentIds.has(placeId)) &&
    candidate.route[0] === selectedStartPlaceId &&
    candidate.route.at(-1) === selectedEndPlaceId
  );
}

export function orderRouteOptimizationPlaces(
  activeDay: TripDay,
  options: Pick<
    RouteOptimizationRequestOptions,
    'selectedStartPlaceId' | 'selectedEndPlaceId'
  >,
): TripPlace[] {
  const orderedPlaces = getOrderedPlaces(activeDay);
  const start = orderedPlaces.find(
    (place) => place.id === options.selectedStartPlaceId,
  );
  const end = orderedPlaces.find(
    (place) => place.id === options.selectedEndPlaceId,
  );
  if (!start || !end || start.id === end.id) {
    return orderedPlaces;
  }
  return [
    start,
    ...orderedPlaces.filter(
      (place) => place.id !== start.id && place.id !== end.id,
    ),
    end,
  ];
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

function resolveRequestOptions(
  activeDay: RouteOptimizationDay,
  orderedPlaces: readonly TripPlace[],
  options?: RouteOptimizationRequestOptions,
): {
  selectedStartPlaceId: string;
  selectedEndPlaceId: string;
  startPolicy: TrouteStartPolicy;
  startTime: string | null;
  travelMode: TrouteTravelMode;
} {
  return {
    selectedStartPlaceId:
      options?.selectedStartPlaceId ?? orderedPlaces[0]?.id ?? '',
    selectedEndPlaceId:
      options?.selectedEndPlaceId ?? orderedPlaces.at(-1)?.id ?? '',
    startPolicy: START_POLICY_BY_UI[options?.startPolicy ?? 'latest'],
    startTime:
      options?.startTime ??
      (options ? null : resolveMinimumStartTime(activeDay, orderedPlaces)),
    travelMode:
      options?.travelMode ?? getRouteOptimizationTravelMode(activeDay),
  };
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

function resolveServiceStartTime(
  arrivalTime: string,
  serviceStartTime: string | undefined,
  departureTime: string | undefined,
  waitMinutes: number | undefined,
  stayMinutes: number,
  isStart: boolean,
): string | null {
  if (serviceStartTime) {
    return serviceStartTime;
  }
  if (isStart) {
    return arrivalTime;
  }
  if (waitMinutes !== undefined) {
    return addClockMinutes(arrivalTime, waitMinutes);
  }
  if (departureTime) {
    return addClockMinutes(departureTime, -stayMinutes);
  }
  return arrivalTime;
}

function addClockMinutes(time: string, minutes: number): string | null {
  const total = clockToMinutes(time) + minutes;
  if (total < 0 || total >= MINUTES_PER_DAY) {
    return null;
  }
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
}

function getForwardMinutes(from: string, to: string): number | null {
  const difference = clockToMinutes(to) - clockToMinutes(from);
  return difference >= 0 ? difference : null;
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
