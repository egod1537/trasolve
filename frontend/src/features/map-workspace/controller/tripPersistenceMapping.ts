import type { Trip, TripInput } from '@trasolve/shared';
/** Compare canonical trips while normalizing IDs assigned to newly created items. */
export function semanticTripKey(
  trip: Trip,
  knownIds: ReadonlySet<string>,
): string {
  const labels = new Map<string, string>();
  trip.days.forEach((day, dayIndex) => {
    if (!knownIds.has(day.id)) {
      labels.set(day.id, `new:day:${dayIndex}`);
    }
    day.places.forEach((place, index) => {
      if (!knownIds.has(place.id)) {
        labels.set(place.id, `new:place:${dayIndex}:${index}`);
      }
    });
    day.polylines.forEach((polyline, index) => {
      if (!knownIds.has(polyline.id)) {
        labels.set(polyline.id, `new:polyline:${dayIndex}:${index}`);
      }
    });
  });
  return JSON.stringify(createTripInput(trip)).replace(
    /"((?:[^"\\]|\\.)*)"/g,
    (token, value: string) =>
      labels.has(value) ? JSON.stringify(labels.get(value)) : token,
  );
}
export function createTripInput(trip: Trip): TripInput {
  return {
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    days: trip.days.map((day) => ({
      ...day,
      places: day.places.map((place) => ({ ...place })),
      polylines: day.polylines.map((polyline) => ({ ...polyline })),
      layerItems: day.layerItems.map((layerItem) => ({ ...layerItem })),
    })),
  };
}
