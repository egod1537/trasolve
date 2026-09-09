import type { Trip, TripInput } from '@trasolve/shared';
import type { Trip as TripView, TripRoute } from './trip';

/** Visiting-order geometry shared by initial state, edits and rollback. */
export function tripToRoutes(trip: Trip): TripRoute[] {
  return trip.days.map((day) => ({
    dayId: day.id,
    color: day.color,
    path: day.places.map((place) => ({ ...place.location })),
  }));
}

export function tripToView(trip: Trip): TripView {
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

export function tripViewToInput(view: TripView, stored?: Trip): TripInput {
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
