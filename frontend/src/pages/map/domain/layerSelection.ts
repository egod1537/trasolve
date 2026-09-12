import type { Trip } from '@trasolve/shared';

export type LayerSelection =
  | { type: 'day'; dayId: string }
  | { type: 'place'; dayId: string; placeId: string }
  | { type: 'polyline'; dayId: string; polylineId: string }
  | null;

export function resolveLayerSelection(
  trip: Trip,
  selectedDayId: string | null,
  selectedPlaceId: string | null,
  selectedPolylineId: string | null,
): LayerSelection {
  if (selectedPlaceId) {
    const day = trip.days.find((candidate) =>
      candidate.places.some((place) => place.id === selectedPlaceId),
    );
    if (day) return { type: 'place', dayId: day.id, placeId: selectedPlaceId };
  }
  if (selectedPolylineId) {
    const day = trip.days.find((candidate) =>
      candidate.polylines.some(
        (polyline) => polyline.id === selectedPolylineId,
      ),
    );
    if (day) {
      return {
        type: 'polyline',
        dayId: day.id,
        polylineId: selectedPolylineId,
      };
    }
  }
  return selectedDayId ? { type: 'day', dayId: selectedDayId } : null;
}
