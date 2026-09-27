import type { RouteLocation, TravelMode } from '@trasolve/shared';

export type QueryRouteDuration = (
  request: {
    origin: RouteLocation;
    destination: RouteLocation;
    travelMode: TravelMode;
  },
  signal: AbortSignal,
) => Promise<number | null>;
