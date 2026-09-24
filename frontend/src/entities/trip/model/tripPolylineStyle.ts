import type { TripPolylineMode } from '@trasolve/shared';
import type { MapPolylineStyle } from '@/shared/map/MapPolylineHandle';

type TripPolylineBaseStyle = Required<
  Pick<
    MapPolylineStyle,
    | 'color'
    | 'width'
    | 'pattern'
    | 'patternRepeatPx'
    | 'directionRepeatPx'
    | 'directionScale'
  >
>;

export const TRIP_POLYLINE_MODE_STYLES = {
  straight: {
    color: '#2563eb',
    width: 4,
    pattern: 'solid',
    patternRepeatPx: 20,
    directionRepeatPx: 88,
    directionScale: 3.6,
  },
  walking: {
    color: '#059669',
    width: 3.5,
    pattern: 'short-dash',
    patternRepeatPx: 17,
    directionRepeatPx: 76,
    directionScale: 3.4,
  },
  transit: {
    color: '#7c3aed',
    width: 4.5,
    pattern: 'stations',
    patternRepeatPx: 34,
    directionRepeatPx: 102,
    directionScale: 3.7,
  },
  driving: {
    color: '#ea580c',
    width: 6,
    pattern: 'solid',
    patternRepeatPx: 20,
    directionRepeatPx: 92,
    directionScale: 4.2,
  },
} as const satisfies Record<TripPolylineMode, TripPolylineBaseStyle>;

export function getTripPolylineStyle(
  mode: TripPolylineMode,
  selected: boolean,
  active: boolean,
): MapPolylineStyle {
  const modeStyle = TRIP_POLYLINE_MODE_STYLES[mode];
  return {
    ...modeStyle,
    width: modeStyle.width + (selected ? 2 : active ? 0.75 : 0),
    opacity: selected ? 1 : active ? 0.92 : 0.68,
    directional: true,
    directionScale: modeStyle.directionScale + (selected ? 0.45 : 0),
  };
}
