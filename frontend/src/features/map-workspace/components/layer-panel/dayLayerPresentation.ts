import type { useDayReorder } from '@/features/map-workspace/hooks/useDayReorder';
import type { LayerSelectionModifiers } from '@/features/map-workspace/model/useMapWorkspace';
import {
  type PlaceDragState,
  type usePlaceReorder,
} from '@/features/map-workspace/hooks/usePlaceReorder';
import type {
  LayerItem,
  TripDay,
  TripPlace,
  TripPolyline,
} from '@/entities/trip';

export type ReorderControls = ReturnType<typeof usePlaceReorder>;

export type DayReorderControls = ReturnType<typeof useDayReorder>;

export type DropIndicator = {
  itemKey: string;
  position: 'before' | 'after';
} | null;

export type RenderedLayerItem =
  | {
      type: 'place';
      key: string;
      place: TripPlace;
    }
  | {
      type: 'polyline';
      key: string;
      polyline: TripPolyline;
    };

export type SelectionProps = {
  selectedPlaceId: string | null;
  selectedPlaceIds: ReadonlySet<string>;
  selectedPolylineId: string | null;
  selectedPolylineIds: ReadonlySet<string>;
  selectedDayId: string | null;
  visibleDayIds: ReadonlySet<string>;
  onSelectPlace: (id: string, modifiers: LayerSelectionModifiers) => void;
  onFocusPlace: (id: string) => void;
  onSelectPlaceForDetails: (id: string) => void;
  onSelectPlaceForDrag: (id: string) => void;
  onSelectPolyline: (id: string, modifiers: LayerSelectionModifiers) => void;
  onSelectPolylineForDetails: (id: string) => void;
  onSelectDay: (id: string) => void;
  onToggleDayVisibility: (id: string) => void;
};

export function getDropIndicator(
  day: TripDay,
  dragState: PlaceDragState | null,
): DropIndicator {
  if (
    !dragState ||
    dragState.targetDayId !== day.id ||
    (dragState.sourceDayId === dragState.targetDayId &&
      dragState.targetIndex === dragState.sourceIndex)
  ) {
    return null;
  }

  const stationaryPlaces = day.places.filter(
    (place) => place.id !== dragState.placeId,
  );
  const nextPlace = stationaryPlaces[dragState.targetIndex];
  if (nextPlace) {
    return { itemKey: `place:${nextPlace.id}`, position: 'before' };
  }
  const lastPlace = stationaryPlaces.at(-1);
  return lastPlace
    ? { itemKey: `place:${lastPlace.id}`, position: 'after' }
    : null;
}

export function getPreviewOffset(
  dayId: string,
  placeId: string,
  dragState: PlaceDragState | null,
  dayPreviewOffset: number,
): number {
  if (!dragState) {
    return 0;
  }
  const dragging =
    dragState.sourceDayId === dayId && dragState.placeId === placeId;
  if (dragging) {
    return dragState.currentY - dragState.startY - dayPreviewOffset;
  }
  return 0;
}

export function layerItemKey(item: LayerItem): string {
  return `${item.type}:${item.id}`;
}
