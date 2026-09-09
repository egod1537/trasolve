import type { CSSProperties, ReactNode, Ref } from 'react';
import type {
  LatLng,
  MapEvents,
  MapHandle,
  MapOptions,
  MapPolyline,
} from '../../domain/map/mapTypes';

// Preserve the component's public names over provider-neutral domain contracts.
export type {
  LatLng,
  MapBounds,
  MapClickEvent,
  MapPlace,
  MapPolyline,
  MapOptions as GoogleMapOptions,
  MapHandle as GoogleMapHandle,
  MapEvents as GoogleMapEvents,
} from '../../domain/map/mapTypes';

export type GoogleMapStatus = 'loading' | 'ready' | 'missing-key' | 'error';

export type GoogleMapProps = MapEvents & {
  ref?: Ref<MapHandle>;
  center?: LatLng;
  zoom?: number;
  mapId?: string;
  options?: MapOptions;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  polylines?: readonly MapPolyline[];
  onReady?: (map: MapHandle) => void;
  onError?: (error: Error) => void;
  renderStatus?: (status: Exclude<GoogleMapStatus, 'ready'>) => ReactNode;
  children?: ReactNode;
};
