import { useMemo, useState } from 'react';
import type { TripMap } from '@trasolve/shared';
import type { MapFocus, MapFocusTarget } from '../domain/mapUiTypes';
import { getGeoBounds } from '../domain/geometry';

export function useMapUi(trip: TripMap) {
  const [focus, setFocus] = useState<MapFocus>({ type: 'all', revision: 0 });
  const selectedDay = trip.days.find((day) =>
    focus.type === 'day'
      ? day.id === focus.dayId
      : focus.type === 'place' &&
        day.places.some((place) => place.id === focus.placeId),
  );
  const selectedPlace =
    focus.type === 'place'
      ? selectedDay?.places.find((place) => place.id === focus.placeId)
      : undefined;
  const points = (selectedDay ? [selectedDay] : trip.days).flatMap((day) =>
    day.places.map((place) => place.location),
  );
  const bounds = getGeoBounds(points);
  const lat = selectedPlace?.location.lat,
    lng = selectedPlace?.location.lng;
  const north = bounds?.north,
    south = bounds?.south,
    east = bounds?.east,
    west = bounds?.west;
  const revision = focus.revision;
  const focusTarget = useMemo<MapFocusTarget>(
    () =>
      lat !== undefined && lng !== undefined
        ? { type: 'place', revision, point: { lat, lng } }
        : {
            type: 'bounds',
            revision,
            bounds:
              north === undefined ||
              south === undefined ||
              east === undefined ||
              west === undefined
                ? null
                : { north, south, east, west },
          },
    [lat, lng, north, south, east, west, revision],
  );
  return {
    focusTarget,
    selectionRevision: revision,
    selectedPlaceId: selectedPlace?.id ?? null,
    selectedDayId: selectedDay?.id ?? null,
    selectPlace: (placeId: string) =>
      setFocus((current) => ({
        type: 'place',
        placeId,
        revision: current.revision + 1,
      })),
    selectDay: (dayId: string) =>
      setFocus((current) => ({
        type: 'day',
        dayId,
        revision: current.revision + 1,
      })),
    showAll: () =>
      setFocus((current) => ({ type: 'all', revision: current.revision + 1 })),
  };
}
