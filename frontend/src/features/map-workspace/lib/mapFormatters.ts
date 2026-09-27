import type { TripPolylineMode } from '@trasolve/shared';
import { formatDurationMinutes } from '@/shared/i18n/formatters';
import { L, NL, type Localize } from '@/shared/i18n';

export const POLYLINE_MODES: readonly TripPolylineMode[] = [
  'straight',
  'walking',
  'transit',
  'driving',
];

export function formatPolylineMode(
  mode: TripPolylineMode,
  localize: Localize = L,
): string {
  const keys: Record<TripPolylineMode, string> = {
    straight: 'map:polylineMode.pOLYLINEMODEOPTIONS.label.straightLine',
    walking: 'map:polylineMode.pOLYLINEMODEOPTIONS.label.walk',
    transit: 'map:polylineMode.pOLYLINEMODEOPTIONS.label.publicTransportation',
    driving: 'map:polylineMode.pOLYLINEMODEOPTIONS.label.car',
  };
  return localize(keys[mode]);
}

export function formatPolylineDistance(
  distanceMeters: number | undefined,
  localize: Localize = L,
): string {
  if (distanceMeters === undefined) {
    return localize(
      'map:polylineMetrics.formatPolylineDistance.text.noRouteInformation',
    );
  }
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} ${NL('m')}`;
  }
  const kilometers = distanceMeters / 1000;
  return `${kilometers < 10 ? kilometers.toFixed(1) : Math.round(kilometers)} ${NL('km')}`;
}

export function formatRouteDuration(
  durationMillis: number,
  localize: Localize = L,
): string {
  const durationMinutes = Math.max(1, Math.round(durationMillis / 60_000));
  return formatDurationMinutes(durationMinutes, localize);
}
