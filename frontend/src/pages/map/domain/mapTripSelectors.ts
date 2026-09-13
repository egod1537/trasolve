import type { Trip, TripDay, TripPlace, TripPolyline } from '@trasolve/shared';
import type { GeoPoint } from '../../../map/types/mapTypes';

export type SelectedTripPlace = {
  day: TripDay;
  place: TripPlace;
};

export type SelectedTripPolyline = {
  day: TripDay;
  polyline: TripPolyline;
  fromPlace: TripPlace;
  toPlace: TripPlace;
  anchor: GeoPoint;
};

export function selectTripPlace(
  trip: Trip,
  placeId: string | null,
): SelectedTripPlace | null {
  if (!placeId) {
    return null;
  }
  for (const day of trip.days) {
    const place = day.places.find((candidate) => candidate.id === placeId);
    if (place) {
      return { day, place };
    }
  }
  return null;
}

export function selectTripPolyline(
  trip: Trip,
  polylineId: string | null,
  anchor: GeoPoint | null,
): SelectedTripPolyline | null {
  if (!polylineId) {
    return null;
  }
  for (const day of trip.days) {
    const polyline = day.polylines.find(
      (candidate) => candidate.id === polylineId,
    );
    if (!polyline) {
      continue;
    }
    const fromPlace = day.places.find(
      (place) => place.id === polyline.fromPlaceId,
    );
    const toPlace = day.places.find((place) => place.id === polyline.toPlaceId);
    if (!fromPlace || !toPlace) {
      return null;
    }
    const path = polyline.path ?? [fromPlace.location, toPlace.location];
    const resolvedAnchor = anchor ?? path[Math.floor((path.length - 1) / 2)];
    return { day, polyline, fromPlace, toPlace, anchor: resolvedAnchor };
  }
  return null;
}
