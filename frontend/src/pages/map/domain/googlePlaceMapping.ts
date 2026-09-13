import type { PlaceDetails, TripPlace } from '@trasolve/shared';

export type GoogleTripPlaceInput = Omit<
  TripPlace,
  'id' | 'order' | 'placeId'
> & {
  placeId: string;
};

export function createTripPlaceFromGooglePlace(
  place: PlaceDetails,
): GoogleTripPlaceInput {
  return {
    placeId: place.id,
    name: place.name,
    address: place.address,
    location: { ...place.location },
    memo: '',
    openingHours: place.openingHours,
  };
}
