import {
  trouteOptimizeRequestSchema,
  trouteStartPolicySchema,
  trouteTravelModeSchema,
  type TrouteOptimizeRequest,
  type TrouteStartPolicy,
  type TrouteTravelMode,
  type TripDay,
  type TripPlace,
} from '@trasolve/shared';
import {
  type RouteOptimizationDay,
  type RouteOptimizationStartPolicy,
  type RouteOptimizationPlacePreference,
  type RouteOptimizationRequestOptions,
  type RouteOptimizationIssue,
  RouteOptimizationValidationError,
  type RouteOptimizationDiagnostics,
} from '@/features/route-optimization/model/routeOptimizationTypes';
import { getLocationConstraint } from '@/features/route-optimization/model/optimizationConstraints';
import {
  isClockTime,
  isTenMinuteClock,
} from '@/features/route-optimization/model/optimizationClock';
export {
  type RouteOptimizationStartPolicy,
  type RouteOptimizationVisitPolicy,
  type RouteOptimizationPlacePreference,
  type RouteOptimizationRequestOptions,
  type RouteOptimizationIssue,
  RouteOptimizationValidationError,
  type RouteOptimizationDiagnostics,
  type RouteOptimizationScheduleStop,
  type RouteOptimizationSchedule,
} from '@/features/route-optimization/model/routeOptimizationTypes';
export { getOptimizationStayMinutes } from '@/features/route-optimization/model/optimizationConstraints';
export {
  getBestOptimizationCandidate,
  createRouteOptimizationSchedule,
  createTripScheduleUpdate,
  isApplicableCandidate,
  isTimedOut,
} from '@/features/route-optimization/model/optimizationSchedule';

const DEFAULT_START_TIME = '09:00';

const DEFAULT_TRAVEL_MODE: TrouteTravelMode = 'TRANSIT';

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

const VISIT_POLICY_BY_UI = {
  'all-required': 'ALL_REQUIRED',
  'best-effort-on-failure': 'BEST_EFFORT_ON_FAILURE',
} as const;

export function getRouteOptimizationIssue(
  activeDay: RouteOptimizationDay,
  options?: RouteOptimizationRequestOptions,
): RouteOptimizationIssue | null {
  const orderedPlaces = getOrderedPlaces(activeDay);
  if (orderedPlaces.length < 2) {
    return { code: 'minimumPlaces' };
  }
  const resolved = resolveRequestOptions(activeDay, orderedPlaces, options);
  const placeIds = new Set(orderedPlaces.map((place) => place.id));
  if (!placeIds.has(resolved.selectedStartPlaceId)) {
    return { code: 'startOutsideDay' };
  }
  if (!placeIds.has(resolved.selectedEndPlaceId)) {
    return { code: 'endOutsideDay' };
  }
  if (resolved.selectedStartPlaceId === resolved.selectedEndPlaceId) {
    return { code: 'sameEndpoints' };
  }
  if (!trouteStartPolicySchema.safeParse(resolved.startPolicy).success) {
    return { code: 'unsupportedStartPolicy' };
  }
  if (resolved.startPolicy === 'FIXED') {
    if (!resolved.startTime || !isClockTime(resolved.startTime)) {
      return { code: 'fixedStartRequired' };
    }
    if (!isTenMinuteClock(resolved.startTime)) {
      return { code: 'fixedStartStep' };
    }
  }
  const travelMode = resolved.travelMode;
  if (!trouteTravelModeSchema.safeParse(travelMode).success) {
    return {
      code: 'unsupportedTravelMode',
      values: { String: String(travelMode) },
    };
  }
  const missingPlaceIds = orderedPlaces.filter(
    (place) => !place.placeId?.trim(),
  );
  if (missingPlaceIds.length > 0) {
    return {
      code: 'missingPlaceId',
      values: { value: missingPlaceIds.map((place) => place.name).join(', ') },
    };
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
    throw new RouteOptimizationValidationError(issue);
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
      const preference = resolved.placePreferences[place.id] ?? {
        required: false,
        priority: 1,
      };
      const endpoint = index === 0 || index === requestPlaces.length - 1;
      return {
        id: place.id.trim(),
        place_id: place.placeId!.trim(),
        latitude: place.location.lat,
        longitude: place.location.lng,
        open_time: constraint.openTime,
        close_time: constraint.closeTime,
        stay_minutes: constraint.stayMinutes,
        ...(resolved.visitPolicy === 'BEST_EFFORT_ON_FAILURE'
          ? {
              required: endpoint || preference.required,
              priority: preference.priority,
            }
          : {}),
      };
    }),
    ...(resolved.visitPolicy === 'BEST_EFFORT_ON_FAILURE'
      ? { visit_policy: resolved.visitPolicy }
      : {}),
    start_policy: resolved.startPolicy,
    ...(resolved.startPolicy === 'FIXED'
      ? { start_time: resolved.startTime! }
      : {}),
    travel_mode: resolved.travelMode,
    use_euclidean_matrix: true,
  };
  try {
    return trouteOptimizeRequestSchema.parse(request);
  } catch {
    throw new RouteOptimizationValidationError({ code: 'invalidRequest' });
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

function getOrderedPlaces(activeDay: TripDay): TripPlace[] {
  return [...activeDay.places].sort((left, right) => left.order - right.order);
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
  visitPolicy: 'ALL_REQUIRED' | 'BEST_EFFORT_ON_FAILURE';
  placePreferences: Readonly<Record<string, RouteOptimizationPlacePreference>>;
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
    visitPolicy: VISIT_POLICY_BY_UI[options?.visitPolicy ?? 'all-required'],
    placePreferences: options?.placePreferences ?? {},
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
