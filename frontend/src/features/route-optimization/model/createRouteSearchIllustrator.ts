import type { TripDay } from '@trasolve/shared';
import type { RouteComparisonData } from './routeComparison';
import type { RouteOptimizationRequestOptions } from './routeOptimizationTypes';
import { orderRouteOptimizationPlaces } from './routeOptimization';

/** Local visual moves only; actual candidates reset the displayed starting route. */
export function createRouteSearchIllustrator(
  day: TripDay,
  options: RouteOptimizationRequestOptions,
  onCancel: () => void,
) {
  const places = orderRouteOptimizationPlaces(day, options);
  const placesById = new Map(places.map((place) => [place.id, place]));
  const initialOrder = places.map((place) => place.id);
  const fingerprint = JSON.stringify(day);
  return (previous: RouteComparisonData | null): RouteComparisonData | null => {
    const placeIds = [...(previous?.update.placeIds ?? initialOrder)];
    const moves: [number, number][] = [];
    for (let left = 1; left < placeIds.length - 1; left += 1) {
      if (placesById.get(placeIds[left]!)?.orderLocked) {
        continue;
      }
      // Swap within a three-stop window, including around a pinned middle stop.
      for (
        let right = left + 1;
        right <= left + 2 && right < placeIds.length - 1;
        right += 1
      ) {
        if (!placesById.get(placeIds[right]!)?.orderLocked) {
          moves.push([left, right]);
        }
      }
    }
    if (moves.length === 0) {
      return null;
    }
    const [left, right] = moves[Math.floor(Math.random() * moves.length)]!;
    [placeIds[left], placeIds[right]] = [placeIds[right]!, placeIds[left]!];
    return {
      day,
      fingerprint,
      travelMode: options.travelMode,
      update: {
        placeIds,
        stops: [],
        expectedStartPlaceId: options.selectedStartPlaceId,
        expectedEndPlaceId: options.selectedEndPlaceId,
      },
      live: { hasResult: false, illustrative: true, revision: 0, onCancel },
    };
  };
}
