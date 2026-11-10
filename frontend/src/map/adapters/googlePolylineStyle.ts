import type {
  MapPolylinePattern,
  MapPolylineStyle,
} from '@/map/adapters/MapObjectController';

export type ResolvedPolylineStyle = {
  color: string;
  width: number;
  opacity: number;
  pattern: MapPolylinePattern;
  patternRepeatPx: number;
  directional: boolean;
  directionRepeatPx: number;
  directionScale: number;
};

export const DIRECTION_ARROW_OUTLINE_COLOR = '#ffffff';

export const DIRECTION_ARROW_OUTLINE_WIDTH = 1.5;

export function resolvePolylineStyle(
  style: MapPolylineStyle | undefined,
): ResolvedPolylineStyle {
  return {
    color: style?.color ?? '#2563eb',
    width: style?.width ?? 5,
    opacity: style?.opacity ?? 0.85,
    pattern: style?.pattern ?? 'solid',
    patternRepeatPx: style?.patternRepeatPx ?? 20,
    directional: style?.directional ?? false,
    directionRepeatPx: style?.directionRepeatPx ?? 88,
    directionScale: style?.directionScale ?? 3.5,
  };
}

export function updatePolylineStyle(
  current: ResolvedPolylineStyle,
  update: MapPolylineStyle,
): void {
  for (const key of Object.keys(update) as Array<keyof MapPolylineStyle>) {
    const value = update[key];
    if (value !== undefined) {
      Object.assign(current, { [key]: value });
    }
  }
}

export function createPolylineIcons(
  style: ResolvedPolylineStyle,
): google.maps.IconSequence[] {
  const icons: google.maps.IconSequence[] = [];
  if (style.pattern === 'short-dash') {
    icons.push({
      icon: {
        path: 'M 0,-2 0,2',
        scale: 1,
        strokeColor: style.color,
        strokeOpacity: style.opacity,
        strokeWeight: style.width,
      },
      offset: '0',
      repeat: `${style.patternRepeatPx}px`,
    });
  } else if (style.pattern === 'stations') {
    icons.push({
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: style.color,
        fillOpacity: style.opacity,
        scale: Math.max(2.4, style.width * 0.55),
        strokeColor: '#ffffff',
        strokeOpacity: style.opacity,
        strokeWeight: 1,
      },
      offset: `${Math.round(style.patternRepeatPx / 2)}px`,
      repeat: `${style.patternRepeatPx}px`,
    });
  }
  if (style.directional) {
    const directionIcon: google.maps.Symbol = {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      fillColor: style.color,
      fillOpacity: style.opacity,
      scale: style.directionScale,
      strokeColor: DIRECTION_ARROW_OUTLINE_COLOR,
      strokeOpacity: style.opacity,
      strokeWeight: DIRECTION_ARROW_OUTLINE_WIDTH,
    };
    icons.push({
      icon: directionIcon,
      offset: '50%',
    });
    icons.push({
      icon: directionIcon,
      offset: `${Math.round(style.directionRepeatPx / 2)}px`,
      repeat: `${style.directionRepeatPx}px`,
    });
  }
  return icons;
}

export function applyPolylineStyle(
  line: google.maps.Polyline | null,
  style: ResolvedPolylineStyle,
): void {
  line?.setOptions({
    strokeColor: style.color,
    strokeWeight: style.width,
    strokeOpacity: style.pattern === 'short-dash' ? 0 : style.opacity,
    icons: createPolylineIcons(style),
  });
}

export function arePolylineStylesEqual(
  left: ResolvedPolylineStyle,
  right: ResolvedPolylineStyle,
): boolean {
  return (
    left.color === right.color &&
    left.width === right.width &&
    left.opacity === right.opacity &&
    left.pattern === right.pattern &&
    left.patternRepeatPx === right.patternRepeatPx &&
    left.directional === right.directional &&
    left.directionRepeatPx === right.directionRepeatPx &&
    left.directionScale === right.directionScale
  );
}

export function arePathsEqual(
  left: readonly { lat: number; lng: number }[],
  right: readonly { lat: number; lng: number }[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (point, index) =>
        point.lat === right[index]!.lat && point.lng === right[index]!.lng,
    )
  );
}
