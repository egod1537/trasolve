import type { PlaceStyle } from '@trasolve/shared';
import type { useDayReorder } from '@/features/map-workspace/hooks/useDayReorder';
import type { LayerSelectionModifiers } from '@/features/map-workspace/model/useMapWorkspace';
import {
  type PlaceDragState,
  type usePlaceReorder,
} from '@/features/map-workspace/hooks/usePlaceReorder';
import type {
  LayerItem,
  LayerValidationByItemKey,
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
      index: number;
    }
  | {
      type: 'polyline';
      key: string;
      polyline: TripPolyline;
      fromPlace?: TripPlace;
      toPlace?: TripPlace;
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

export type DayLayerSectionProps = Omit<
  SelectionProps,
  | 'selectedDayId'
  | 'selectedPlaceId'
  | 'selectedPolylineId'
  | 'visibleDayIds'
  | 'onSelectPlaceForDetails'
  | 'onSelectPlaceForDrag'
  | 'onSelectPolylineForDetails'
  | 'onSelectDay'
> & {
  day: TripDay;
  active: boolean;
  visible: boolean;
  dayIndex: number;
  layerItemDayPreviewOffset: number;
  expanded: boolean;
  placeDropTargetPending: boolean;
  reorder: ReorderControls;
  dayReorder: DayReorderControls;
  dayDropIndicator: 'before' | 'after' | null;
  onBeforeLayerItemDrag: (placeId: string) => void;
  editingPlaceId: string | null;
  detailPlaceId: string | null;
  detailPolylineId: string | null;
  onRenameDay: (dayId: string, title: string) => void;
  onUpdateDayColor: (dayId: string, color: string) => void;
  onRequestDeleteDay: (day: { id: string; title: string }) => void;
  onShuffleDayPlaces: (dayId: string) => void;
  onRenamePlace: (placeId: string, name: string) => void;
  onUpdatePlaceStyle: (placeId: string, style: PlaceStyle) => void;
  onStartPlaceNameEditing: (placeId: string) => void;
  onFinishPlaceNameEditing: (placeId: string) => void;
  onOpenPlaceDetails: (placeId: string) => void;
  onOpenPolylineDetails: (polylineId: string) => void;
  validationByItemKey?: LayerValidationByItemKey;
  onActivateDay: (dayId: string) => void;
  onToggleExpanded: (dayId: string) => void;
};

/** Compare selection/validation only for this day; compare every other prop by identity. */
export function areDayLayerPropsEqual(
  previous: DayLayerSectionProps,
  next: DayLayerSectionProps,
): boolean {
  for (const key of Object.keys(next) as (keyof DayLayerSectionProps)[]) {
    if (
      key !== 'selectedPlaceIds' &&
      key !== 'selectedPolylineIds' &&
      key !== 'validationByItemKey' &&
      !Object.is(previous[key], next[key])
    ) {
      return false;
    }
  }
  return (
    (previous.selectedPlaceIds === next.selectedPlaceIds ||
      next.day.places.every(
        ({ id }) =>
          previous.selectedPlaceIds.has(id) === next.selectedPlaceIds.has(id),
      )) &&
    (previous.selectedPolylineIds === next.selectedPolylineIds ||
      next.day.polylines.every(
        ({ id }) =>
          previous.selectedPolylineIds.has(id) ===
          next.selectedPolylineIds.has(id),
      )) &&
    (previous.validationByItemKey === next.validationByItemKey ||
      next.day.layerItems.every(
        (item) =>
          previous.validationByItemKey?.[layerItemKey(item)] ===
          next.validationByItemKey?.[layerItemKey(item)],
      ))
  );
}

/** Resolve indices and route endpoints once per expanded day, in linear time. */
export function resolveLayerItems(day: TripDay): RenderedLayerItem[] {
  const places = new Map(
    day.places.map((place, index) => [place.id, { place, index }]),
  );
  const polylines = new Map(
    day.polylines.map((polyline) => [polyline.id, polyline]),
  );
  return day.layerItems.flatMap((item): RenderedLayerItem[] => {
    const key = layerItemKey(item);
    if (item.type === 'place') {
      const entry = places.get(item.id);
      return entry ? [{ type: 'place', key, ...entry }] : [];
    }
    const polyline = polylines.get(item.id);
    return polyline
      ? [
          {
            type: 'polyline',
            key,
            polyline,
            fromPlace: places.get(polyline.fromPlaceId)?.place,
            toPlace: places.get(polyline.toPlaceId)?.place,
          },
        ]
      : [];
  });
}

export function findPlaceContext(
  days: TripDay[],
  visibleDayIds: ReadonlySet<string>,
  placeId: string | null,
) {
  if (!placeId) {
    return undefined;
  }
  for (const day of days) {
    if (!visibleDayIds.has(day.id)) {
      continue;
    }
    const place = day.places.find((item) => item.id === placeId);
    if (place) {
      return { day, place };
    }
  }
  return undefined;
}

export function findPolylineContext(
  days: TripDay[],
  visibleDayIds: ReadonlySet<string>,
  polylineId: string | null,
) {
  if (!polylineId) {
    return undefined;
  }
  for (const day of days) {
    if (!visibleDayIds.has(day.id)) {
      continue;
    }
    const polyline = day.polylines.find((item) => item.id === polylineId);
    if (!polyline) {
      continue;
    }
    const fromPlace = day.places.find(
      (place) => place.id === polyline.fromPlaceId,
    );
    const toPlace = day.places.find((place) => place.id === polyline.toPlaceId);
    return fromPlace && toPlace ? { polyline, fromPlace, toPlace } : undefined;
  }
  return undefined;
}
