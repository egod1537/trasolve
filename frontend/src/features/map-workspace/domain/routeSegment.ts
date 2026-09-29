import {
  TravelMode,
  type DirectionsRequest,
  type RouteLocation,
  type TripPolylineMode,
} from '@trasolve/shared';
import type { GeoPoint } from '@/shared/types/mapTypes';

export type RoutableMode = Exclude<TripPolylineMode, 'straight'>;

export const ROUTABLE_MODES = [
  'walking',
  'transit',
  'driving',
] as const satisfies ReadonlyArray<RoutableMode>;

const TRAVEL_MODE_BY_ROUTABLE_MODE: Record<RoutableMode, TravelMode> = {
  walking: TravelMode.WALKING,
  transit: TravelMode.TRANSIT,
  driving: TravelMode.DRIVING,
};

export type RouteSegmentEndpoint = {
  placeId?: string;
  location: GeoPoint;
};

/** One provider-neutral route query for a pair of Trip places. */
export type RouteSegmentQuery = {
  key: string;
  mode: RoutableMode;
  request: DirectionsRequest;
};

export type RouteSegmentStepKind = 'walk' | 'transit' | 'drive' | 'other';

export type RouteSegmentTransit = {
  lineName: string | null;
  lineShortName: string | null;
  vehicleType: string | null;
  headsign: string | null;
  departureStop: string | null;
  arrivalStop: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  stopCount: number | null;
};

export type RouteSegmentStep = {
  kind: RouteSegmentStepKind;
  distanceMeters: number | null;
  durationMillis: number | null;
  instructions: readonly string[];
  transit: RouteSegmentTransit | null;
};

export type RouteSegmentDetail = {
  distanceMeters: number | null;
  durationMillis: number | null;
  fare: { amount: number; currencyCode: string } | null;
  path: readonly GeoPoint[];
  steps: readonly RouteSegmentStep[];
  warnings: readonly string[];
};

/** Raw failure codes; the UI boundary translates them. */
export type RouteSegmentErrorReason =
  'not-found' | 'timeout' | 'network' | 'request-failed';

export type RouteSegmentState =
  | { status: 'loading' }
  | { status: 'ready'; detail: RouteSegmentDetail }
  | {
      status: 'error';
      reason: RouteSegmentErrorReason;
      /** Already-localized API error message, when the client provided one. */
      message: string | null;
    };

function toRouteLocation(endpoint: RouteSegmentEndpoint): RouteLocation {
  if (endpoint.placeId) {
    return { type: 'place', placeId: endpoint.placeId };
  }
  return {
    type: 'coordinates',
    lat: endpoint.location.lat,
    lng: endpoint.location.lng,
  };
}

function toLocationKey(location: RouteLocation): string {
  switch (location.type) {
    case 'place':
      return `place:${location.placeId}`;
    case 'coordinates':
      return `coordinates:${location.lat},${location.lng}`;
    case 'address':
      return `address:${location.address}`;
  }
}

export function isRoutableMode(mode: TripPolylineMode): mode is RoutableMode {
  return mode !== 'straight';
}

export function createRouteSegmentQuery(
  from: RouteSegmentEndpoint,
  to: RouteSegmentEndpoint,
  mode: RoutableMode,
): RouteSegmentQuery {
  const origin = toRouteLocation(from);
  const destination = toRouteLocation(to);
  return {
    // Place endpoints change the key, so moved places never reuse stale paths.
    key: `${mode}|${toLocationKey(origin)}|${toLocationKey(destination)}`,
    mode,
    request: {
      origin,
      destination,
      travelMode: TRAVEL_MODE_BY_ROUTABLE_MODE[mode],
      computeAlternativeRoutes: false,
    },
  };
}

export function createPolylineRouteQuery(
  from: RouteSegmentEndpoint,
  to: RouteSegmentEndpoint,
  mode: TripPolylineMode,
): RouteSegmentQuery | null {
  return isRoutableMode(mode) ? createRouteSegmentQuery(from, to, mode) : null;
}

export function formatRouteTransitLine(
  transit: RouteSegmentTransit,
): string | null {
  return (
    [transit.lineShortName, transit.lineName].find(
      (value): value is string => !!value,
    ) ?? null
  );
}

export function formatRouteClockTime(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) {
    return value.match(/T(\d{2}:\d{2})/)?.[1] ?? value;
  }
  return time.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatRouteFare(
  fare: RouteSegmentDetail['fare'],
): string | null {
  if (!fare) {
    return null;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: fare.currencyCode,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: fare.amount % 1 === 0 ? 0 : 2,
    }).format(fare.amount);
  } catch {
    return `${fare.amount.toLocaleString()} ${fare.currencyCode}`;
  }
}
