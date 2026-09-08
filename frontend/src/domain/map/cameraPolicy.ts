import type { MapPadding, ScreenPoint } from './mapTypes';

type Rect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type MapViewportLayout = {
  canvasRect: Rect;
  sidebarRect?: Rect;
  mobile: boolean;
};

export function calculateMapPadding({
  canvasRect,
  sidebarRect,
  mobile,
}: MapViewportLayout): MapPadding {
  // Reserve the panel and search area while keeping the map full-bleed.
  return {
    top: 88,
    right: mobile ? 44 : 64,
    bottom:
      mobile && sidebarRect ? canvasRect.bottom - sidebarRect.top + 24 : 56,
    left:
      !mobile && sidebarRect ? sidebarRect.right - canvasRect.left + 32 : 40,
  };
}

export function calculatePlacePanOffset(padding: MapPadding): ScreenPoint {
  return {
    x: (padding.right - padding.left) / 2,
    y: (padding.bottom - padding.top) / 2,
  };
}

export function calculatePlaceZoom(currentZoom: number): number {
  return Math.max(currentZoom, 15);
}

export function calculateBoundsZoom(currentZoom: number): number {
  // One place (or coincident places) must not zoom all the way into a building.
  return Math.min(currentZoom, 16);
}
