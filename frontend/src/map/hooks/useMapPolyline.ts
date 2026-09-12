import { useEffect, useLayoutEffect, useRef } from 'react';
import type {
  MapObjectController,
  MapPolylineHandle,
  MapPolylineOptions,
} from '../adapters/MapObjectController';

export function useMapPolyline(
  objects: MapObjectController,
  options: MapPolylineOptions,
): void {
  const handle = useRef<MapPolylineHandle | null>(null);
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const { id, layer, path, visible, zIndex } = options;
  const {
    color = '#2563eb',
    width = 5,
    opacity = 0.85,
    pattern = 'solid',
    patternRepeatPx = 20,
    directional = false,
    directionRepeatPx = 88,
    directionScale = 3.5,
  } = options.style ?? {};

  useEffect(() => {
    const line = objects.addPolyline({ ...latest.current, id, layer });
    handle.current = line;
    return () => {
      line.remove();
      handle.current = null;
    };
  }, [objects, id, layer]);

  useEffect(() => {
    const line = handle.current;
    if (!line) {
      return;
    }
    line.setPath(path);
    line.setStyle({
      color,
      width,
      opacity,
      pattern,
      patternRepeatPx,
      directional,
      directionRepeatPx,
      directionScale,
    });
    line.setVisible(visible ?? true);
    line.setZIndex(zIndex ?? 0);
  }, [
    objects,
    id,
    layer,
    path,
    color,
    width,
    opacity,
    pattern,
    patternRepeatPx,
    directional,
    directionRepeatPx,
    directionScale,
    visible,
    zIndex,
  ]);
}
