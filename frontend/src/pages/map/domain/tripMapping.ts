import type { Trip, TripInput } from '@trasolve/shared';
import type { Trip as TripView } from './trip';

export function tripToView(trip: Trip): TripView {
  return {
    title: trip.title,
    period:
      [trip.startDate, trip.endDate].filter(Boolean).join(' — ') || '날짜 미정',
    days: trip.days.map((day) => ({
      ...day,
      places: day.places.map((place) => ({
        ...place,
        ...place.location,
        description: place.memo ?? '',
      })),
      polylines: day.polylines.map((polyline) => ({
        ...polyline,
        path: polyline.path?.map((point) => ({ ...point })),
      })),
      layerItems: day.layerItems.map((item) => ({ ...item })),
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
        id: place.id,
        placeId: place.placeId ?? places.get(place.id)?.placeId,
        address: place.address ?? places.get(place.id)?.address,
        name: place.name,
        location: { lat: place.lat, lng: place.lng },
        order: place.order,
        memo: place.description,
        openingHours: place.openingHours ?? places.get(place.id)?.openingHours,
        placeStyle: place.placeStyle ?? places.get(place.id)?.placeStyle,
        durationMinutes:
          place.durationMinutes ?? places.get(place.id)?.durationMinutes,
        time: place.time,
      })),
      polylines: day.polylines.map((polyline) => ({
        ...polyline,
        id: polyline.id,
        path: polyline.path?.map((point) => ({ ...point })),
      })),
      layerItems: day.layerItems.map((item) => ({ ...item })),
    })),
  };
}
