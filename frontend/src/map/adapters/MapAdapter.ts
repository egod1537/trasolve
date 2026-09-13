import type {
  GeoBounds,
  GeoPoint,
  MapCameraState,
  MapPadding,
  ScreenPoint,
} from '../types/mapTypes';

export interface MapAdapter {
  getCenter(): GeoPoint | null;
  getZoom(): number;
  getBounds(): GeoBounds | null;
  getCamera(): MapCameraState | null;

  panTo(point: GeoPoint, centerOffset?: ScreenPoint): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: GeoBounds, padding?: MapPadding): void;

  subscribeCameraChange(callback: () => void): () => void;
  dispose(): void;
}
