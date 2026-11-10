import type { MapMarkerRouteRole } from './MapMarkerHandle';

export function getRouteMarkerRole(
  index: number,
  count: number,
): MapMarkerRouteRole | undefined {
  if (count === 1 && index === 0) {
    return 'start-end';
  }
  if (index === 0 && count > 1) {
    return 'start';
  }
  if (index === count - 1 && count > 1) {
    return 'end';
  }
  return undefined;
}
