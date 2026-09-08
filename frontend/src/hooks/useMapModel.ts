import { useSyncExternalStore } from 'react';
import type { MapModel } from '../domain/map/MapModel';

export function useMapModel(model: MapModel) {
  return useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
}
