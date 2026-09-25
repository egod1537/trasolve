import type { GeoPoint } from '@/shared/types/mapTypes';
import type {
  MapObjectBaseOptions,
  MapObjectHandle,
} from '@/shared/map/MapObjectHandle';

export type MapMarkerEmphasis =
  'none' | 'selectable' | 'source' | 'target' | 'unavailable';

export type MapMarkerIcon = {
  viewBox: string;
  paths: readonly string[];
};

export type MapMarkerContextMenuEvent = {
  clientX: number;
  clientY: number;
};

export type MapMarkerOptions = MapObjectBaseOptions & {
  position: GeoPoint;
  title?: string;
  selected?: boolean;
  color?: string;
  icon?: MapMarkerIcon;
  label?: string;
};

export interface MapMarkerHandle extends MapObjectHandle {
  setPosition(position: GeoPoint): void;
  setTitle(title?: string): void;
  setSelected(selected: boolean): void;
  setColor(color?: string): void;
  setIcon(icon?: MapMarkerIcon): void;
  setLabel(label?: string): void;
  setEmphasis(emphasis: MapMarkerEmphasis): void;
  onClick(callback: () => void): () => void;
  onContextMenu(
    callback: (event: MapMarkerContextMenuEvent) => void,
  ): () => void;
  onPointerEnter(callback: () => void): () => void;
  onPointerLeave(callback: () => void): () => void;
}
