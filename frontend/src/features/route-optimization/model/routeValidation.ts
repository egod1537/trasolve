import {
  FAST_ROUTE_VALIDATION_MAX_LOCATIONS,
  type TripDay,
  type RouteValidationRequest,
} from '@trasolve/shared';
import {
  createRouteOptimizationRequest,
  getRouteOptimizationIssue,
  type RouteOptimizationIssue,
  type RouteOptimizationRequestOptions,
} from './routeOptimization';
import { getLocationConstraint } from './optimizationConstraints';

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
  unsupported: boolean;
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
  const unsupported = places.length > FAST_ROUTE_VALIDATION_MAX_LOCATIONS;
  if (issues.length || places.length < 2 || unsupported) {
    return { issues, request: null, unknownHours, unsupported };
  }
  // Use exactly the optimizer's endpoints, windows, visit/start policies and
  // locks. Existing displayed service times are predictions, not fixed visits.
  const route = createRouteOptimizationRequest(day, settings);
  return {
    issues,
    unknownHours,
    unsupported,
    request: {
      route: { ...route, job_id: `validate-${day.id.slice(0, 80)}` },
      check_feasibility: true,
      service_start_times: {},
    },
  };
}
