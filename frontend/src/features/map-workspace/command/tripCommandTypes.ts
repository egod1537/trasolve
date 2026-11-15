import { type TripPlace } from '@trasolve/shared';

export type PlaceInput = Omit<TripPlace, 'id' | 'order'>;
