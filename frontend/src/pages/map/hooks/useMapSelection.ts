import { useCallback, useMemo, useState } from 'react';
import type { Trip } from '@trasolve/shared';
import type { GeoPoint } from '../../../map/types/mapTypes';

export type SelectableLayerType = 'place' | 'polyline';

export type SelectableLayerItem = {
  type: SelectableLayerType;
  id: string;
};

export type LayerSelectionMode = 'replace' | 'toggle' | 'range' | 'details';

type LayerMultiSelectionState = {
  dayId: string | null;
  items: SelectableLayerItem[];
  primary: SelectableLayerItem | null;
  anchor: SelectableLayerItem | null;
  primaryPolylineAnchor: GeoPoint | null;
};

const EMPTY_SELECTION: LayerMultiSelectionState = {
  dayId: null,
  items: [],
  primary: null,
  anchor: null,
  primaryPolylineAnchor: null,
};

function itemKey(item: SelectableLayerItem): string {
  return `${item.type}:${item.id}`;
}

function replaceSelection(
  dayId: string,
  item: SelectableLayerItem,
  polylineAnchor?: GeoPoint,
): LayerMultiSelectionState {
  return {
    dayId,
    items: [item],
    primary: item,
    anchor: item,
    primaryPolylineAnchor:
      item.type === 'polyline' && polylineAnchor ? { ...polylineAnchor } : null,
  };
}

function sameItem(
  left: SelectableLayerItem | null,
  right: SelectableLayerItem,
): boolean {
  return !!left && left.type === right.type && left.id === right.id;
}

export function useMapSelection(trip: Trip) {
  const [selection, setSelection] =
    useState<LayerMultiSelectionState>(EMPTY_SELECTION);
  const [revision, setRevision] = useState(0);
  const { itemDayIds, validItemKeys } = useMemo(() => {
    const nextItemDayIds = new Map<string, string>();
    const nextValidItemKeys = new Set<string>();
    for (const day of trip.days) {
      for (const place of day.places) {
        const key = itemKey({ type: 'place', id: place.id });
        nextItemDayIds.set(key, day.id);
        nextValidItemKeys.add(key);
      }
      for (const polyline of day.polylines) {
        const key = itemKey({ type: 'polyline', id: polyline.id });
        nextItemDayIds.set(key, day.id);
        nextValidItemKeys.add(key);
      }
    }
    return {
      itemDayIds: nextItemDayIds,
      validItemKeys: nextValidItemKeys,
    };
  }, [trip.days]);
  const selectedItems = useMemo(
    () =>
      selection.dayId
        ? selection.items.filter(
            (item) => itemDayIds.get(itemKey(item)) === selection.dayId,
          )
        : [],
    [itemDayIds, selection.dayId, selection.items],
  );
  const selectedItemKeys = useMemo(
    () => new Set(selectedItems.map(itemKey)),
    [selectedItems],
  );
  const selectedPlaceIds = useMemo<ReadonlySet<string>>(
    () =>
      new Set(
        selectedItems.flatMap((item) =>
          item.type === 'place' ? [item.id] : [],
        ),
      ),
    [selectedItems],
  );
  const selectedPolylineIds = useMemo<ReadonlySet<string>>(
    () =>
      new Set(
        selectedItems.flatMap((item) =>
          item.type === 'polyline' ? [item.id] : [],
        ),
      ),
    [selectedItems],
  );
  const fallbackPrimary = selectedItems.at(-1) ?? null;
  const primary =
    selection.primary && selectedItemKeys.has(itemKey(selection.primary))
      ? selection.primary
      : fallbackPrimary;
  const selectedPlaceId = primary?.type === 'place' ? primary.id : null;
  const selectedPolylineId = primary?.type === 'polyline' ? primary.id : null;
  const selectedPolylineAnchor =
    selectedPolylineId &&
    selection.primary?.type === 'polyline' &&
    selection.primary.id === selectedPolylineId
      ? selection.primaryPolylineAnchor
      : null;

  const selectItem = useCallback(
    (
      nextItem: SelectableLayerItem,
      dayId: string,
      orderedItems: readonly SelectableLayerItem[],
      mode: LayerSelectionMode = 'replace',
      polylineAnchor?: GeoPoint,
    ) => {
      setRevision((current) => current + 1);
      setSelection((current) => {
        const currentItems = current.items.filter(
          (item) =>
            validItemKeys.has(itemKey(item)) &&
            itemDayIds.get(itemKey(item)) === dayId,
        );
        if (
          mode === 'replace' ||
          current.dayId !== dayId ||
          currentItems.length === 0
        ) {
          return replaceSelection(dayId, nextItem, polylineAnchor);
        }

        const nextKey = itemKey(nextItem);
        if (mode === 'details') {
          return currentItems.some((item) => itemKey(item) === nextKey)
            ? {
                ...current,
                items: currentItems,
                primary: nextItem,
                primaryPolylineAnchor:
                  nextItem.type === 'polyline' && polylineAnchor
                    ? { ...polylineAnchor }
                    : null,
              }
            : replaceSelection(dayId, nextItem, polylineAnchor);
        }

        if (mode === 'toggle') {
          if (!currentItems.some((item) => itemKey(item) === nextKey)) {
            return {
              dayId,
              items: [...currentItems, nextItem],
              primary: nextItem,
              anchor: nextItem,
              primaryPolylineAnchor:
                nextItem.type === 'polyline' && polylineAnchor
                  ? { ...polylineAnchor }
                  : null,
            };
          }

          const nextItems = currentItems.filter(
            (item) => itemKey(item) !== nextKey,
          );
          const fallback = nextItems.at(-1) ?? null;
          if (!fallback) return EMPTY_SELECTION;
          const removingPrimary = sameItem(current.primary, nextItem);
          const removingAnchor = sameItem(current.anchor, nextItem);
          return {
            dayId,
            items: nextItems,
            primary: removingPrimary ? fallback : current.primary,
            anchor: removingAnchor ? fallback : current.anchor,
            primaryPolylineAnchor: removingPrimary
              ? null
              : current.primaryPolylineAnchor,
          };
        }

        const anchorKey = current.anchor ? itemKey(current.anchor) : null;
        const anchorIndex = anchorKey
          ? orderedItems.findIndex((item) => itemKey(item) === anchorKey)
          : -1;
        const targetIndex = orderedItems.findIndex(
          (item) => itemKey(item) === nextKey,
        );
        if (anchorIndex < 0 || targetIndex < 0) {
          return replaceSelection(dayId, nextItem, polylineAnchor);
        }
        const rangeStart = Math.min(anchorIndex, targetIndex);
        const rangeEnd = Math.max(anchorIndex, targetIndex);
        return {
          dayId,
          items: orderedItems.slice(rangeStart, rangeEnd + 1),
          primary: nextItem,
          anchor: current.anchor,
          primaryPolylineAnchor:
            nextItem.type === 'polyline' && polylineAnchor
              ? { ...polylineAnchor }
              : null,
        };
      });
    },
    [itemDayIds, validItemKeys],
  );

  const clearType = useCallback(
    (type: SelectableLayerType) => {
      setRevision((current) => current + 1);
      setSelection((current) => {
        const nextItems = current.items.filter(
          (item) => item.type !== type && validItemKeys.has(itemKey(item)),
        );
        const fallback = nextItems.at(-1) ?? null;
        if (!fallback) return EMPTY_SELECTION;
        const primary =
          current.primary?.type === type ? fallback : current.primary;
        return {
          ...current,
          items: nextItems,
          primary,
          anchor: current.anchor?.type === type ? fallback : current.anchor,
          primaryPolylineAnchor:
            primary?.type === 'polyline' &&
            current.primary?.type === 'polyline' &&
            primary.id === current.primary.id
              ? current.primaryPolylineAnchor
              : null,
        };
      });
    },
    [validItemKeys],
  );
  const clearPlace = useCallback(() => clearType('place'), [clearType]);
  const clearPolyline = useCallback(() => clearType('polyline'), [clearType]);
  const clear = useCallback(() => {
    setRevision((current) => current + 1);
    setSelection(EMPTY_SELECTION);
  }, []);

  return useMemo(
    () => ({
      selectedPlaceId,
      selectedPlaceIds,
      selectedPolylineId,
      selectedPolylineIds,
      selectedPolylineAnchor,
      selectedItemCount: selectedItems.length,
      revision,
      selectItem,
      clearPlace,
      clearPolyline,
      clear,
    }),
    [
      clear,
      clearPlace,
      clearPolyline,
      revision,
      selectItem,
      selectedItems.length,
      selectedPlaceId,
      selectedPlaceIds,
      selectedPolylineAnchor,
      selectedPolylineId,
      selectedPolylineIds,
    ],
  );
}
