import type {
  RoutableMode,
  RouteSegmentDetail,
  RouteSegmentStep,
  RouteSegmentStepKind,
} from '@/features/map-workspace/domain/routeSegment';

/** Raw label codes; the UI translates them. */
export type RouteCandidateLabel =
  'recommended' | 'fastest' | 'fewest-transfers' | 'least-walking' | 'shortest';

export type RouteCandidateVehicleCategory = 'bus' | 'rail' | 'mixed' | 'none';

export type RouteCandidateSegment = {
  kind: RouteSegmentStepKind;
  /** Share of the total duration, 0-1. */
  ratio: number;
  /** Agency color for transit lines when provided. */
  color: string | null;
  textColor: string | null;
  /** Short line name for transit segments. */
  lineName: string | null;
  vehicleType: string | null;
};

export type RouteCandidateViewModel = {
  /** Index in the provider response; also the selection key. */
  index: number;
  labels: readonly RouteCandidateLabel[];
  durationMillis: number | null;
  distanceMeters: number | null;
  arrivalAt: Date | null;
  fare: RouteSegmentDetail['fare'];
  /** Transit line names in riding order. */
  lineNames: readonly string[];
  /** Provider summary such as the main road. */
  description: string;
  segments: readonly RouteCandidateSegment[];
  transfers: number;
  walkingMillis: number;
  vehicleCategory: RouteCandidateVehicleCategory;
  /** Walking only; derived from distance, so it is an estimate. */
  estimatedSteps: number | null;
  detail: RouteSegmentDetail;
};

export type TransitFilter = 'all' | 'bus' | 'rail' | 'mixed';
export type TransitSort =
  'best' | 'fewest-transfers' | 'least-walking' | 'fastest';

const AVERAGE_STEP_METERS = 0.7;
const BUS_VEHICLES = new Set([
  'BUS',
  'INTERCITY_BUS',
  'TROLLEYBUS',
  'SHARE_TAXI',
]);

function isTransitStep(step: RouteSegmentStep): boolean {
  return step.kind === 'transit';
}

function toVehicleCategory(
  steps: readonly RouteSegmentStep[],
): RouteCandidateVehicleCategory {
  let bus = false;
  let rail = false;
  for (const step of steps) {
    if (!isTransitStep(step)) {
      continue;
    }
    if (BUS_VEHICLES.has(step.transit?.vehicleType ?? '')) {
      bus = true;
    } else {
      rail = true;
    }
  }
  if (bus && rail) {
    return 'mixed';
  }
  return bus ? 'bus' : rail ? 'rail' : 'none';
}

function toSegments(
  steps: readonly RouteSegmentStep[],
): RouteCandidateSegment[] {
  const timed = steps.filter((step) => (step.durationMillis ?? 0) > 0);
  const total = timed.reduce((sum, step) => sum + step.durationMillis!, 0);
  if (total === 0) {
    return [];
  }
  return timed.map((step) => ({
    kind: step.kind,
    ratio: step.durationMillis! / total,
    color: step.transit?.lineColor ?? null,
    textColor: step.transit?.lineTextColor ?? null,
    lineName: step.transit?.lineShortName ?? step.transit?.lineName ?? null,
    vehicleType: step.transit?.vehicleType ?? null,
  }));
}

function toViewModel(
  mode: RoutableMode,
  detail: RouteSegmentDetail,
  index: number,
  now: Date,
): RouteCandidateViewModel {
  const transitSteps = detail.steps.filter(isTransitStep);
  return {
    index,
    labels: [],
    durationMillis: detail.durationMillis,
    distanceMeters: detail.distanceMeters,
    arrivalAt:
      detail.durationMillis === null
        ? null
        : new Date(now.getTime() + detail.durationMillis),
    fare: detail.fare,
    lineNames: transitSteps
      .map(
        (step) => step.transit?.lineShortName ?? step.transit?.lineName ?? '',
      )
      .filter((name) => name.length > 0),
    description: detail.description,
    segments: toSegments(detail.steps),
    transfers: Math.max(0, transitSteps.length - 1),
    walkingMillis: detail.steps
      .filter((step) => step.kind === 'walk')
      .reduce((sum, step) => sum + (step.durationMillis ?? 0), 0),
    vehicleCategory: toVehicleCategory(detail.steps),
    estimatedSteps:
      mode === 'walking' && detail.distanceMeters !== null
        ? Math.round(detail.distanceMeters / AVERAGE_STEP_METERS)
        : null,
    detail,
  };
}

/** Indexes holding the unique minimum of `value`, or none when tied/absent. */
function uniqueMinimum(
  items: readonly RouteCandidateViewModel[],
  value: (item: RouteCandidateViewModel) => number | null,
): number | null {
  let best: number | null = null;
  let bestIndex: number | null = null;
  let tied = false;
  for (const item of items) {
    const current = value(item);
    if (current === null) {
      continue;
    }
    if (best === null || current < best) {
      best = current;
      bestIndex = item.index;
      tied = false;
    } else if (current === best) {
      tied = true;
    }
  }
  return tied ? null : bestIndex;
}

/**
 * Builds comparable candidate cards. The first provider route is the
 * recommendation; other labels mark a unique best value among candidates.
 */
export function buildRouteCandidateViewModels(
  mode: RoutableMode,
  candidates: readonly RouteSegmentDetail[],
  now: Date,
): RouteCandidateViewModel[] {
  const items = candidates.map((detail, index) =>
    toViewModel(mode, detail, index, now),
  );
  if (items.length < 2) {
    return items.map((item) => ({ ...item, labels: ['recommended'] }));
  }
  const fastest = uniqueMinimum(items, (item) => item.durationMillis);
  const shortest =
    mode === 'transit'
      ? null
      : uniqueMinimum(items, (item) => item.distanceMeters);
  const fewestTransfers =
    mode === 'transit' ? uniqueMinimum(items, (item) => item.transfers) : null;
  const leastWalking =
    mode === 'transit'
      ? uniqueMinimum(items, (item) => item.walkingMillis)
      : null;
  return items.map((item) => {
    const labels: RouteCandidateLabel[] = [];
    if (item.index === 0) {
      labels.push('recommended');
    }
    if (item.index === fastest) {
      labels.push('fastest');
    }
    if (item.index === fewestTransfers) {
      labels.push('fewest-transfers');
    }
    if (item.index === leastWalking) {
      labels.push('least-walking');
    }
    if (item.index === shortest) {
      labels.push('shortest');
    }
    return { ...item, labels };
  });
}

const SORT_VALUE: Record<
  Exclude<TransitSort, 'best'>,
  (item: RouteCandidateViewModel) => number
> = {
  'fewest-transfers': (item) => item.transfers,
  'least-walking': (item) => item.walkingMillis,
  fastest: (item) => item.durationMillis ?? Number.POSITIVE_INFINITY,
};

export function filterAndSortTransitCandidates(
  items: readonly RouteCandidateViewModel[],
  filter: TransitFilter,
  sort: TransitSort,
): RouteCandidateViewModel[] {
  const filtered =
    filter === 'all'
      ? [...items]
      : items.filter((item) => item.vehicleCategory === filter);
  if (sort === 'best') {
    return filtered;
  }
  const value = SORT_VALUE[sort];
  // Stable: ties keep the provider's recommended order.
  return filtered.sort((a, b) => value(a) - value(b) || a.index - b.index);
}
