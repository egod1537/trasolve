import type { DirectionsResult, MapRoute } from '@trasolve/shared';
import type {
  RouteSegmentDetail,
  RouteSegmentStep,
  RouteSegmentStepKind,
} from '@/features/map-workspace/domain/routeSegment';

type MapRouteStep = MapRoute['legs'][number]['steps'][number];

function toStepKind(
  travelMode: string | null | undefined,
): RouteSegmentStepKind {
  switch (travelMode) {
    case 'WALK':
    case 'WALKING':
      return 'walk';
    case 'DRIVE':
    case 'DRIVING':
      return 'drive';
    case 'TRANSIT':
      return 'transit';
    default:
      return 'other';
  }
}

function sumNullable(
  current: number | null,
  next: number | null,
): number | null {
  if (current === null) {
    return next;
  }
  return next === null ? current : current + next;
}

function toStep(
  step: MapRouteStep,
  fallbackKind: RouteSegmentStepKind,
): RouteSegmentStep {
  const kind = step.travelMode ? toStepKind(step.travelMode) : fallbackKind;
  return {
    kind,
    distanceMeters: step.distanceMeters,
    durationMillis: step.durationMillis,
    instructions: step.instruction ? [step.instruction] : [],
    transit: step.transitDetails ? { ...step.transitDetails } : null,
  };
}

/** Collapses consecutive walk/drive turns into one itinerary row. */
function groupSteps(steps: readonly RouteSegmentStep[]): RouteSegmentStep[] {
  const grouped: RouteSegmentStep[] = [];
  for (const step of steps) {
    const previous = grouped.at(-1);
    if (previous && step.kind !== 'transit' && previous.kind === step.kind) {
      grouped[grouped.length - 1] = {
        ...previous,
        distanceMeters: sumNullable(
          previous.distanceMeters,
          step.distanceMeters,
        ),
        durationMillis: sumNullable(
          previous.durationMillis,
          step.durationMillis,
        ),
        instructions: [...previous.instructions, ...step.instructions],
      };
      continue;
    }
    grouped.push(step);
  }
  return grouped;
}

export function toRouteSegmentDetail(
  result: DirectionsResult,
): RouteSegmentDetail | null {
  const route = result.routes.at(0);
  if (!route || route.path.length < 2) {
    return null;
  }
  const fallbackKind = toStepKind(result.request.travelMode);
  return {
    distanceMeters: route.distanceMeters,
    durationMillis: route.durationMillis,
    fare: route.fare ? { ...route.fare } : null,
    path: route.path.map((point) => ({ lat: point.lat, lng: point.lng })),
    steps: groupSteps(
      route.legs.flatMap((leg) =>
        leg.steps.map((step) => toStep(step, fallbackKind)),
      ),
    ),
    warnings: [...route.warnings],
  };
}
