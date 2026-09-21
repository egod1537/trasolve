import {
  routeOptimizationRequestSchema,
  type RouteOptimizationRequest,
  type TripDay,
} from '@trasolve/shared';

type RouteOptimizationInputOptions = Pick<
  RouteOptimizationRequest,
  'includeStayDuration'
>;

export function createRouteOptimizationRequest(
  activeDay: TripDay,
  options: RouteOptimizationInputOptions,
): RouteOptimizationRequest {
  return routeOptimizationRequestSchema.parse({
    dayId: activeDay.id,
    includeStayDuration: options.includeStayDuration,
    places: activeDay.places.map((place) => ({
      id: place.id,
      name: place.name,
      location: { ...place.location },
      time: place.time ?? null,
      visitDurationMinutes: place.visitDurationMinutes ?? null,
      preferredDurationMinutes: place.preferredDurationMinutes ?? null,
      openingHours: place.openingHours ?? null,
    })),
  });
}
