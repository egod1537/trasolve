import type { RouteLocation, TravelMode } from '@trasolve/shared';
import { formatDurationMinutes } from './placeDuration';

export type QueryRouteDuration = (
  request: {
    origin: RouteLocation;
    destination: RouteLocation;
    travelMode: TravelMode;
  },
  signal: AbortSignal,
) => Promise<number | null>;

export function formatRouteDuration(durationMillis: number): string {
  const durationMinutes = Math.max(1, Math.round(durationMillis / 60_000));
  return formatDurationMinutes(durationMinutes);
}
