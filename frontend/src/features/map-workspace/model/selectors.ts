import type { Trip, TripPolyline } from '@trasolve/shared';

export function selectActiveDay(trip: Trip, selectedDayId: string | null) {
  return trip.days.find((day) => day.id === selectedDayId) ?? null;
}

export function selectPolylines(
  trip: Trip,
  selectedPolylineIds: ReadonlySet<string>,
): TripPolyline[] {
  return trip.days.flatMap((day) =>
    day.polylines.filter((polyline) => selectedPolylineIds.has(polyline.id)),
  );
}

export function selectTripById(
  trips: readonly Trip[],
  selectedTripId: string | null,
): Trip | null {
  return trips.find((trip) => trip.id === selectedTripId) ?? null;
}
