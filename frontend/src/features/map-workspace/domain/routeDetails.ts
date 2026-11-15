import type {
  MapRoute,
  RouteLocation,
  TravelMode,
  TripPolylineMode,
} from '@trasolve/shared';

export type QueryRouteDetails = (
  request: {
    origin: RouteLocation;
    destination: RouteLocation;
    travelMode: TravelMode;
  },
  signal: AbortSignal,
) => Promise<readonly MapRoute[]>;

export type RoutableMode = Exclude<TripPolylineMode, 'straight'>;
export type RouteEndpoint = {
  name: string;
  placeId?: string;
  location: { lat: number; lng: number };
};
