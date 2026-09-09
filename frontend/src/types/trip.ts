import type { GeoPoint } from '../domain/map/mapTypes';

export type Coordinates = GeoPoint;

export type TripPlace = Coordinates & {
  id: string;
  name: string;
  description: string;
  time?: string;
  order: number;
};

export type TripDay = {
  id: string;
  title: string;
  date?: string;
  color: string;
  places: TripPlace[];
};

export type Trip = {
  title: string;
  period: string;
  days: TripDay[];
};

// A route is independent of its provider. Routes API geometry can replace path.
export type TripRoute = { dayId: string; color: string; path: Coordinates[] };
