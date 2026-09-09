import type { MapAdapter } from './MapAdapter';
import type { MapOverlayHost } from './MapOverlayHost';
import type { MapObjectController } from './MapObjectController';
import type { LatLng, MapEvents, MapOptions } from '../types/mapTypes';

export interface MapRuntime {
  adapter: MapAdapter;
  objects: MapObjectController;
  overlayHost: MapOverlayHost;
  setOptions(options: MapOptions): void;
  subscribeEvents(events: MapEvents): () => void;
  dispose(): void;
}

export type MapRuntimeConfig = {
  center?: LatLng;
  zoom?: number;
  mapId?: string;
  options?: MapOptions;
};
