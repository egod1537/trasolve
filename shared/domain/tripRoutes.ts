import type { TripDay, TripPolyline } from '../types/trip.js';

type RouteDay = Pick<TripDay, 'places' | 'polylines' | 'layerItems'>;

function pairKey(fromPlaceId: string, toPlaceId: string): string {
  return `${fromPlaceId}->${toPlaceId}`;
}

export function reconcileDayRouteSegments(
  day: RouteDay,
  createId: () => string,
): void {
  const existingByPair = new Map<string, TripPolyline>();
  for (const polyline of day.polylines) {
    const key = pairKey(polyline.fromPlaceId, polyline.toPlaceId);
    if (!existingByPair.has(key)) existingByPair.set(key, polyline);
  }

  day.places.forEach((place, index) => {
    place.order = index + 1;
  });
  day.polylines = day.places.slice(0, -1).map((place, index) => {
    const toPlace = day.places[index + 1]!;
    const existing = existingByPair.get(pairKey(place.id, toPlace.id));
    return existing
      ? {
          ...existing,
          fromPlaceId: place.id,
          toPlaceId: toPlace.id,
          order: index + 1,
        }
      : {
          id: createId(),
          fromPlaceId: place.id,
          toPlaceId: toPlace.id,
          mode: 'straight',
          order: index + 1,
        };
  });
  day.layerItems = day.places.flatMap((place, index) => {
    const polyline = day.polylines[index];
    return polyline
      ? [
          { type: 'place' as const, id: place.id },
          { type: 'polyline' as const, id: polyline.id },
        ]
      : [{ type: 'place' as const, id: place.id }];
  });
}
