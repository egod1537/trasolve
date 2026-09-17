import type { GeoPoint } from '@/shared/types/mapTypes';
import type {
  MapObjectBaseOptions,
  MapObjectHandle,
} from '@/shared/map/MapObjectHandle';
import type {
  MapMarkerHandle,
  MapMarkerIcon,
  MapMarkerOptions,
} from '@/shared/map/MapMarkerHandle';
import type {
  MapPolylineHandle,
  MapPolylineOptions,
  MapPolylinePattern,
  MapPolylineStyle,
} from '@/shared/map/MapPolylineHandle';

export type {
  MapObjectBaseOptions,
  MapObjectHandle,
  MapMarkerHandle,
  MapMarkerIcon,
  MapMarkerOptions,
  MapPolylineHandle,
  MapPolylineOptions,
  MapPolylinePattern,
  MapPolylineStyle,
};

export type MapPolygonStyle = {
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  fillColor?: string;
  fillOpacity?: number;
};
export type MapCircleStyle = MapPolygonStyle;

export interface MapPolygonHandle extends MapObjectHandle {
  setPath(path: readonly GeoPoint[]): void;
  setStyle(style: MapPolygonStyle): void;
}

export interface MapCircleHandle extends MapObjectHandle {
  setCenter(center: GeoPoint): void;
  setRadius(radiusMeters: number): void;
  setStyle(style: MapCircleStyle): void;
}

export type MapPolygonOptions = MapObjectBaseOptions & {
  path: readonly GeoPoint[];
  style?: MapPolygonStyle;
};
export type MapCircleOptions = MapObjectBaseOptions & {
  center: GeoPoint;
  radiusMeters: number;
  style?: MapCircleStyle;
};

export interface MapObjectController {
  addMarker(options: MapMarkerOptions): MapMarkerHandle;
  addPolyline(options: MapPolylineOptions): MapPolylineHandle;
  // Optional capabilities for providers that support these shapes.
  addPolygon?(options: MapPolygonOptions): MapPolygonHandle;
  addCircle?(options: MapCircleOptions): MapCircleHandle;
  remove(object: MapObjectHandle): void;
  clearLayer(layer: string): void;
  clear(): void;
  /** Removes everything; subsequent add calls throw. */
  dispose(): void;
}
