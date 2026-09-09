import type { TripMap, TripMapInput } from '@trasolve/shared';
import type { Trip } from '../../types/trip';

export function tripMapToView(trip: TripMap): Trip {
  return {
    title: trip.title,
    period:
      [trip.startDate, trip.endDate].filter(Boolean).join(' — ') || '날짜 미정',
    days: trip.days.map((day) => ({
      ...day,
      places: day.places.map((place) => ({
        id: place.id,
        name: place.name,
        ...place.location,
        order: place.order,
        time: place.time,
        description: place.memo ?? '',
      })),
    })),
  };
}

export function tripViewToInput(view: Trip, stored?: TripMap): TripMapInput {
  const places = new Map(
    stored?.days.flatMap((day) =>
      day.places.map((place) => [place.id, place] as const),
    ),
  );
  return {
    title: view.title,
    startDate: stored?.startDate,
    endDate: stored?.endDate,
    days: view.days.map((day) => ({
      id: stored ? day.id : undefined,
      title: day.title,
      date: stored?.days.find((item) => item.id === day.id)?.date,
      color: day.color,
      places: day.places.map((place) => ({
        id: stored ? place.id : undefined,
        placeId: places.get(place.id)?.placeId,
        address: places.get(place.id)?.address,
        name: place.name,
        location: { lat: place.lat, lng: place.lng },
        order: place.order,
        memo: place.description,
        time: place.time,
      })),
    })),
  };
}
