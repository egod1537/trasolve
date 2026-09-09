import type { GeoPoint, ScreenPoint } from '../types/mapTypes';

// Coordinates are local to the host, not to the viewport.
export interface MapOverlayHost {
  getElement(): HTMLElement;
  project(point: GeoPoint): ScreenPoint | null;
  getProjectionRevision(): number;
  subscribeDraw(callback: () => void): () => void;
  dispose(): void;
}
