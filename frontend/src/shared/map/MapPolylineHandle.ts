import type { GeoPoint } from '@/shared/types/mapTypes';
import type {
  MapObjectBaseOptions,
  MapObjectHandle,
} from '@/shared/map/MapObjectHandle';

export type MapPolylinePattern = 'solid' | 'short-dash' | 'stations';

export type MapPolylineStyle = {
  color?: string;
  width?: number;
  opacity?: number;
  pattern?: MapPolylinePattern;
  patternRepeatPx?: number;
  directional?: boolean;
  directionRepeatPx?: number;
  directionScale?: number;
};

export type MapPolylineOptions = MapObjectBaseOptions & {
  path: readonly GeoPoint[];
  style?: MapPolylineStyle;
};

export interface MapPolylineHandle extends MapObjectHandle {
  setPath(path: readonly GeoPoint[]): void;
  /** Partial update; omitted fields retain their current values. */
  setStyle(style: MapPolylineStyle): void;
  onClick(callback: (position: GeoPoint) => void): () => void;
}
