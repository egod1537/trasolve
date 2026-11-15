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

export type MapMarkerCallout = {
  text: string;
  visibility: 'always' | 'hover';
};
export type MapMarkerRouteRole = 'start' | 'end' | 'start-end';

export type MapMarkerOptions = MapObjectBaseOptions & {
  position: GeoPoint;
  draggable?: boolean;
  title?: string;
  selected?: boolean;
  color?: string;
  icon?: MapMarkerIcon;
  label?: string;
  callout?: MapMarkerCallout;
  routeRole?: MapMarkerRouteRole;
};

export interface MapMarkerHandle extends MapObjectHandle {
  setPosition(position: GeoPoint): void;
  onDragEnd(callback: (position: GeoPoint) => void): () => void;
  setTitle(title?: string): void;
  setSelected(selected: boolean): void;
  setColor(color?: string): void;
  setIcon(icon?: MapMarkerIcon): void;
  setLabel(label?: string): void;
  setCallout(callout?: MapMarkerCallout): void;
  setRouteRole(role?: MapMarkerRouteRole): void;
  setEmphasis(emphasis: MapMarkerEmphasis): void;
  onClick(callback: () => void): () => void;
  onDoubleClick(callback: () => void): () => void;
  onContextMenu(
    callback: (event: MapMarkerContextMenuEvent) => void,
  ): () => void;
  onPointerEnter(callback: () => void): () => void;
  onPointerLeave(callback: () => void): () => void;
}
