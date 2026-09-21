import { useCallback, useMemo } from 'react';
import type { Trip } from '@trasolve/shared';
import type { GeoPoint } from '@/shared/types/mapTypes';
import { resolveLayerSelection } from '@/features/map-workspace/domain/layerSelection';
import { useActiveDay } from '@/features/map-workspace/hooks/useActiveDay';
import { useDayVisibility } from '@/features/map-workspace/hooks/useDayVisibility';
import { useMapFocus } from '@/features/map-workspace/hooks/useMapFocus';
import {
  useMapSelection,
  type LayerSelectionMode,
  type SelectableLayerItem,
} from '@/features/map-workspace/hooks/useMapSelection';

export type LayerSelectionModifiers = {
  additive: boolean;
  range: boolean;
};

type MapObjectSelection =
  | { type: 'place'; id: string }
  | { type: 'polyline'; id: string; anchor?: GeoPoint };

/** Composes independent map UI state and coordinates cross-state policies. */
export function useMapWorkspace(trip: Trip) {
  const visibility = useDayVisibility(trip.days);
  const activeDay = useActiveDay(trip.days);
  const selection = useMapSelection(trip);
  const focus = useMapFocus(trip);
  const { visibleDayIds, toggleDayVisibility } = visibility;
  const { selectedDayId, setActiveDayId } = activeDay;
  const {
    selectedPlaceId,
    selectedPlaceIds,
    selectedPolylineId,
    selectedPolylineIds,
    selectedPolylineAnchor,
    selectedItemCount,
    revision: selectionRevision,
    selectItem: selectItemState,
    clearPlace,
    clear,
  } = selection;
  const { focusTarget, revision: focusRevision, focusAll } = focus;
  const layerSelection = useMemo(
    () =>
      resolveLayerSelection(
        trip,
        selectedDayId,
        selectedPlaceId,
        selectedPolylineId,
      ),
    [selectedDayId, selectedPlaceId, selectedPolylineId, trip],
  );
  const selectLayerItemWithMode = useCallback(
    (
      target: SelectableLayerItem,
      mode: LayerSelectionMode,
      anchor?: GeoPoint,
    ) => {
      const day = trip.days.find((candidate) =>
        target.type === 'place'
          ? candidate.places.some((place) => place.id === target.id)
          : candidate.polylines.some((polyline) => polyline.id === target.id),
      );
      if (!day) {
        return;
      }
      selectItemState(
        target,
        day.id,
        day.layerItems.map((item) => ({ ...item })),
        mode,
        anchor,
      );
      setActiveDayId(day.id);
    },
    [selectItemState, setActiveDayId, trip.days],
  );
  const selectMapObject = useCallback(
    (target: MapObjectSelection) => {
      const day = trip.days.find((candidate) =>
        target.type === 'place'
          ? candidate.places.some((place) => place.id === target.id)
          : candidate.polylines.some((polyline) => polyline.id === target.id),
      );
      if (!day) {
        return;
      }
      selectLayerItemWithMode(
        { type: target.type, id: target.id },
        'replace',
        target.type === 'polyline' ? target.anchor : undefined,
      );
    },
    [selectLayerItemWithMode, trip.days],
  );
  const selectPlace = useCallback(
    (placeId: string) => selectMapObject({ type: 'place', id: placeId }),
    [selectMapObject],
  );
  const selectPlaceWithModifiers = useCallback(
    (placeId: string, modifiers: LayerSelectionModifiers) => {
      const mode: LayerSelectionMode = modifiers.range
        ? 'range'
        : modifiers.additive
          ? 'toggle'
          : 'replace';
      selectLayerItemWithMode({ type: 'place', id: placeId }, mode);
    },
    [selectLayerItemWithMode],
  );
  const selectPlaceForDetails = useCallback(
    (placeId: string) =>
      selectLayerItemWithMode({ type: 'place', id: placeId }, 'details'),
    [selectLayerItemWithMode],
  );
  const selectPolyline = useCallback(
    (polylineId: string, anchor?: GeoPoint) =>
      selectMapObject({ type: 'polyline', id: polylineId, anchor }),
    [selectMapObject],
  );
  const selectPolylineWithModifiers = useCallback(
    (polylineId: string, modifiers: LayerSelectionModifiers) => {
      const mode: LayerSelectionMode = modifiers.range
        ? 'range'
        : modifiers.additive
          ? 'toggle'
          : 'replace';
      selectLayerItemWithMode({ type: 'polyline', id: polylineId }, mode);
    },
    [selectLayerItemWithMode],
  );
  const selectPolylineForDetails = useCallback(
    (polylineId: string) =>
      selectLayerItemWithMode({ type: 'polyline', id: polylineId }, 'details'),
    [selectLayerItemWithMode],
  );
  const selectDay = useCallback(
    (dayId: string) => {
      if (!trip.days.some((day) => day.id === dayId)) {
        return;
      }
      clear();
      setActiveDayId(dayId);
    },
    [clear, setActiveDayId, trip.days],
  );
  const showAll = useCallback(() => {
    clear();
    focusAll();
  }, [clear, focusAll]);

  return useMemo(
    () => ({
      focusTarget,
      selectionRevision: selectionRevision + focusRevision,
      selectedPlaceId,
      selectedPlaceIds,
      selectedPolylineId,
      selectedPolylineIds,
      selectedPolylineAnchor,
      selectedItemCount,
      selectedDayId,
      layerSelection,
      visibleDayIds,
      selectPlace,
      selectPlaceWithModifiers,
      selectPlaceForDetails,
      clearPlaceSelection: clearPlace,
      clearMapSelection: clear,
      selectPolyline,
      selectPolylineWithModifiers,
      selectPolylineForDetails,
      selectDay,
      toggleDayVisibility,
      showAll,
    }),
    [
      clear,
      clearPlace,
      focusTarget,
      layerSelection,
      focusRevision,
      selectDay,
      selectPlace,
      selectPlaceForDetails,
      selectPlaceWithModifiers,
      selectPolyline,
      selectPolylineForDetails,
      selectPolylineWithModifiers,
      selectedDayId,
      selectedPlaceId,
      selectedPlaceIds,
      selectedPolylineAnchor,
      selectedPolylineId,
      selectedPolylineIds,
      selectedItemCount,
      selectionRevision,
      showAll,
      toggleDayVisibility,
      visibleDayIds,
    ],
  );
}
