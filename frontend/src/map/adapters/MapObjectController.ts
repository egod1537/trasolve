import type { GeoPoint } from '../types/mapTypes';

export interface MapObjectHandle {
  readonly id: string;
  setVisible(visible: boolean): void;
  setZIndex(zIndex: number): void;
  /** Idempotent. Setters and subscriptions on removed handles are no-ops. */
  remove(): void;
}

export interface MapMarkerHandle extends MapObjectHandle {
  setPosition(position: GeoPoint): void;
  setTitle(title?: string): void;
  setSelected(selected: boolean): void;
  setColor(color?: string): void;
  setIcon(icon?: MapMarkerIcon): void;
  setEmphasis(emphasis: MapMarkerEmphasis): void;
  onClick(callback: () => void): () => void;
  onPointerEnter(callback: () => void): () => void;
  onPointerLeave(callback: () => void): () => void;
}

export type MapMarkerEmphasis =
  'none' | 'selectable' | 'source' | 'target' | 'unavailable';

export type MapMarkerIcon = {
  viewBox: string;
  paths: readonly string[];
};

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

export interface MapPolylineHandle extends MapObjectHandle {
  setPath(path: readonly GeoPoint[]): void;
  /** Partial update; omitted fields retain their current values. */
  setStyle(style: MapPolylineStyle): void;
  onClick(callback: (position: GeoPoint) => void): () => void;
}

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

export type MapObjectBaseOptions = {
  /** Unique within the controller; duplicates throw before creating an object. */
  id?: string;
  layer?: string;
  visible?: boolean;
  zIndex?: number;
};
export type MapMarkerOptions = MapObjectBaseOptions & {
  position: GeoPoint;
  title?: string;
  selected?: boolean;
  color?: string;
  icon?: MapMarkerIcon;
};
export type MapPolylineOptions = MapObjectBaseOptions & {
  path: readonly GeoPoint[];
  style?: MapPolylineStyle;
};
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
