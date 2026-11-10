import { useCallback, useEffect, useState } from 'react';
import type { GeoPoint } from '@/shared/types/mapTypes';
import type { MapTool } from './measurementGeometry';

export function useMeasurement() {
  const [tool, setTool] = useState<MapTool>('pan');
  const [points, setPoints] = useState<readonly GeoPoint[]>([]);
  const selectTool = useCallback((next: MapTool) => {
    setTool(next);
    setPoints([]);
  }, []);
  const clear = useCallback(() => setPoints([]), []);
  const undo = useCallback(() => setPoints((p) => p.slice(0, -1)), []);
  const add = useCallback(
    (point: GeoPoint) =>
      setPoints((p) => [...p, { lat: point.lat, lng: point.lng }]),
    [],
  );
  const move = useCallback(
    (index: number, point: GeoPoint) =>
      setPoints((p) => p.map((v, i) => (i === index ? point : v))),
    [],
  );
  useEffect(() => {
    if (tool === 'pan') {
      return;
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        selectTool('pan');
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [tool, selectTool]);
  return { tool, points, selectTool, clear, undo, add, move };
}
export type Measurement = ReturnType<typeof useMeasurement>;
