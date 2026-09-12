import type { PlaceDetails } from '@trasolve/shared';
import type { GeoPoint } from '../../../map/types/mapTypes';

type PendingGooglePlace = {
  placeId: string;
  clickedLocation: GeoPoint;
};

export type SelectedGooglePlace =
  | null
  | (PendingGooglePlace & { status: 'loading' })
  | (PendingGooglePlace & { status: 'loaded'; place: PlaceDetails })
  | (PendingGooglePlace & { status: 'error' });
