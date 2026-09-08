import type { LatLng, MapBounds } from '../components/google-map/types';
import { loadGoogleMaps } from './googleMaps';

export type TravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
export type DirectionsLocation = string | LatLng;
export type DirectionsRequest = {
  origin: DirectionsLocation;
  destination: DirectionsLocation;
  travelMode?: TravelMode;
  intermediates?: DirectionsLocation[];
  computeAlternativeRoutes?: boolean;
};

export type MapRoute = {
  description: string;
  distanceMeters: number | null;
  durationMillis: number | null;
  path: LatLng[];
  bounds: MapBounds | null;
  warnings: string[];
};

export type DirectionsResult = {
  request: DirectionsRequest;
  routes: MapRoute[];
  /** JSON snapshot of the SDK response; no live Google objects escape. */
  rawResponse: unknown;
};

export async function getDirections(
  request: DirectionsRequest,
): Promise<DirectionsResult> {
  await loadGoogleMaps();
  const { Route } = (await google.maps.importLibrary(
    'routes',
  )) as google.maps.RoutesLibrary;
  const response = await Route.computeRoutes({
    ...request,
    travelMode: request.travelMode ?? 'DRIVING',
    intermediates: request.intermediates?.map((location) => ({ location })),
    fields: [
      'path',
      'viewport',
      'description',
      'distanceMeters',
      'durationMillis',
      'warnings',
    ],
  });
  return {
    request,
    routes: (response.routes ?? []).map((route) => ({
      description: route.description ?? '',
      distanceMeters: route.distanceMeters ?? null,
      durationMillis: route.durationMillis ?? null,
      path: (route.path ?? []).map((point) => ({
        lat: point.lat,
        lng: point.lng,
      })),
      bounds: route.viewport?.toJSON() ?? null,
      warnings: route.warnings ?? [],
    })),
    rawResponse: JSON.parse(JSON.stringify(response)) as unknown,
  };
}
