import type { GoogleMapsLanguageCode } from '@trasolve/shared';
import type { MapAdapter } from '@/map/adapters/MapAdapter';
import type { MapOverlayHost } from '@/map/adapters/MapOverlayHost';
import type { MapObjectController } from '@/map/adapters/MapObjectController';
import type {
  LatLng,
  MapEvents,
  MapOptions,
  MapTheme,
} from '@/shared/types/mapTypes';

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
  language?: GoogleMapsLanguageCode;
  theme?: MapTheme;
  options?: MapOptions;
};
