import type { TripDay } from '@trasolve/shared';
import {
  getRouteOptimizationTravelMode,
  type RouteOptimizationRequestOptions,
} from './routeOptimization';

export function createDayOptimizationSettings(
  day: TripDay,
): RouteOptimizationRequestOptions {
  const orderedPlaces = [...day.places].sort(
    (left, right) => left.order - right.order,
  );
  return {
    selectedStartPlaceId: orderedPlaces[0]?.id ?? '',
    selectedEndPlaceId: orderedPlaces.at(-1)?.id ?? '',
    startPolicy: 'earliest',
    startTime: null,
    travelMode: getRouteOptimizationTravelMode(day),
    visitPolicy: 'all-required',
    placePreferences: {},
  };
}
