import { useCallback, useMemo } from 'react';
import type {
  PlaceDetails,
  PlaceStyle,
  TripPolylineMode,
} from '@trasolve/shared';
import type { GeoPoint, MapClickEvent } from '../../../map/types/mapTypes';
import type { TripEditController } from '../controller/TripEditController';
import { createTripPlaceFromGooglePlace } from '../domain/googlePlaceMapping';
import type { LayerSelectionModifiers, useMapUi } from '../hooks/useMapUi';
import type { useSelectedGooglePlace } from '../hooks/useSelectedGooglePlace';

type MapUi = ReturnType<typeof useMapUi>;
type GooglePlaceSelection = ReturnType<typeof useSelectedGooglePlace>;

export function useMapWorkspaceActions(
  controller: TripEditController,
  ui: MapUi,
  googlePlace: GooglePlaceSelection,
  dayCount: number,
) {
  const {
    close: closeGooglePlace,
    select: selectGooglePlace,
    show: showGooglePlace,
  } = googlePlace;
  const {
    selectPlace,
    selectPlaceWithModifiers,
    selectPlaceForDetails,
    selectPolyline,
    selectPolylineWithModifiers,
    selectPolylineForDetails,
    selectDay,
    toggleDayVisibility,
    clearMapSelection,
    clearPlaceSelection,
  } = ui;
  const selectTripPlace = useCallback(
    (placeId: string) => {
      closeGooglePlace();
      selectPlace(placeId);
    },
    [closeGooglePlace, selectPlace],
  );
  const selectLayerPlace = useCallback(
    (placeId: string, modifiers: LayerSelectionModifiers) => {
      closeGooglePlace();
      selectPlaceWithModifiers(placeId, modifiers);
    },
    [closeGooglePlace, selectPlaceWithModifiers],
  );
  const selectLayerPlaceForDetails = useCallback(
    (placeId: string) => {
      closeGooglePlace();
      selectPlaceForDetails(placeId);
    },
    [closeGooglePlace, selectPlaceForDetails],
  );
  const selectLayerPlaceForDrag = useCallback(
    (placeId: string) => {
      closeGooglePlace();
      selectPlace(placeId);
    },
    [closeGooglePlace, selectPlace],
  );
  const selectTripPolyline = useCallback(
    (polylineId: string, anchor?: GeoPoint) => {
      closeGooglePlace();
      selectPolyline(polylineId, anchor);
    },
    [closeGooglePlace, selectPolyline],
  );
  const selectLayerPolyline = useCallback(
    (polylineId: string, modifiers: LayerSelectionModifiers) => {
      closeGooglePlace();
      selectPolylineWithModifiers(polylineId, modifiers);
    },
    [closeGooglePlace, selectPolylineWithModifiers],
  );
  const selectLayerPolylineForDetails = useCallback(
    (polylineId: string) => {
      closeGooglePlace();
      selectPolylineForDetails(polylineId);
    },
    [closeGooglePlace, selectPolylineForDetails],
  );
  const handleMapClick = useCallback(
    ({ placeId, lat, lng }: MapClickEvent) => {
      if (placeId) {
        clearMapSelection();
        selectGooglePlace(placeId, { lat, lng });
        return;
      }
      closeGooglePlace();
      clearMapSelection();
    },
    [clearMapSelection, closeGooglePlace, selectGooglePlace],
  );
  const selectSearchedGooglePlace = useCallback(
    (place: PlaceDetails) => {
      clearMapSelection();
      showGooglePlace(place);
    },
    [clearMapSelection, showGooglePlace],
  );
  const addGooglePlace = useCallback(
    async (dayId: string, place: PlaceDetails) => {
      const saved = await controller.addPlace(
        dayId,
        createTripPlaceFromGooglePlace(place),
      );
      if (saved) {
        closeGooglePlace();
      }
      return saved;
    },
    [closeGooglePlace, controller],
  );
  const removeTripPlace = useCallback(
    async (placeId: string) => {
      const saved = await controller.removePlace(placeId);
      if (saved) {
        clearPlaceSelection();
      }
      return saved;
    },
    [clearPlaceSelection, controller],
  );
  const addLayer = useCallback(
    () => void controller.addDay(`Day ${dayCount + 1}`),
    [controller, dayCount],
  );
  const moveDay = useCallback(
    (dayId: string, targetIndex: number) =>
      void controller.moveDay(dayId, targetIndex),
    [controller],
  );
  const renameTrip = useCallback(
    (title: string) => void controller.renameTrip(title),
    [controller],
  );
  const renameDay = useCallback(
    (dayId: string, title: string) => void controller.renameDay(dayId, title),
    [controller],
  );
  const updateDayColor = useCallback(
    (dayId: string, color: string) =>
      void controller.updateDayColor(dayId, color),
    [controller],
  );
  const movePlace = useCallback(
    (placeId: string, targetDayId: string, targetIndex: number) =>
      void controller.movePlace(placeId, targetDayId, targetIndex),
    [controller],
  );
  const renamePlace = useCallback(
    (placeId: string, name: string) =>
      controller.updatePlace(placeId, { name }),
    [controller],
  );
  const updatePlaceStyle = useCallback(
    (placeId: string, style: PlaceStyle) =>
      void controller.updatePlaceStyle(placeId, style),
    [controller],
  );
  const updateTripPlaceTimeRange = useCallback(
    (placeId: string, time: string, durationMinutes: number) =>
      controller.updateTimeRange(placeId, time, durationMinutes),
    [controller],
  );
  const updateTripPlaceMemo = useCallback(
    (placeId: string, memo: string) => controller.updateMemo(placeId, memo),
    [controller],
  );
  const updateTripPolylineMode = useCallback(
    (polylineId: string, mode: TripPolylineMode) =>
      controller.updatePolylineMode(polylineId, mode),
    [controller],
  );
  const updateSelectedPolylineModes = useCallback(
    (polylineIds: readonly string[], mode: TripPolylineMode) =>
      controller.updatePolylineModes(polylineIds, mode),
    [controller],
  );
  const removeSelectedPlaces = useCallback(
    (placeIds: readonly string[]) => controller.removePlaces(placeIds),
    [controller],
  );

  return useMemo(
    () => ({
      layerPanel: {
        onAddLayer: addLayer,
        onSelectPlace: selectLayerPlace,
        onSelectPlaceForDetails: selectLayerPlaceForDetails,
        onSelectPlaceForDrag: selectLayerPlaceForDrag,
        onSelectPolyline: selectLayerPolyline,
        onSelectPolylineForDetails: selectLayerPolylineForDetails,
        onSelectDay: selectDay,
        onToggleDayVisibility: toggleDayVisibility,
        onRenameTrip: renameTrip,
        onMoveDay: moveDay,
        onRenameDay: renameDay,
        onUpdateDayColor: updateDayColor,
        onMovePlace: movePlace,
        onRenamePlace: renamePlace,
        onUpdatePlaceStyle: updatePlaceStyle,
        onUpdatePlaceTimeRange: updateTripPlaceTimeRange,
        onUpdatePlaceMemo: updateTripPlaceMemo,
        onRemovePlace: removeTripPlace,
        onUpdatePolylineMode: updateTripPolylineMode,
      },
      mapViewport: {
        onSelectPlace: selectTripPlace,
        onSelectPolyline: selectTripPolyline,
        onMapClick: handleMapClick,
        onSelectSearchedGooglePlace: selectSearchedGooglePlace,
        onCloseGooglePlace: closeGooglePlace,
        onAddGooglePlace: addGooglePlace,
        onCloseTripPlace: clearPlaceSelection,
        onUpdateTripPlaceTimeRange: updateTripPlaceTimeRange,
        onUpdateTripPlaceMemo: updateTripPlaceMemo,
        onRenameTripPlace: renamePlace,
        onUpdateTripPlaceStyle: updatePlaceStyle,
        onRemoveTripPlace: removeTripPlace,
        onCloseTripPolyline: clearMapSelection,
        onUpdateTripPolylineMode: updateTripPolylineMode,
        onUpdateSelectedPolylineModes: updateSelectedPolylineModes,
        onRemoveSelectedPlaces: removeSelectedPlaces,
        onClearSelection: clearMapSelection,
      },
    }),
    [
      addLayer,
      addGooglePlace,
      clearMapSelection,
      clearPlaceSelection,
      closeGooglePlace,
      handleMapClick,
      moveDay,
      movePlace,
      removeTripPlace,
      removeSelectedPlaces,
      renameTrip,
      renameDay,
      updateDayColor,
      renamePlace,
      selectTripPlace,
      selectLayerPlace,
      selectLayerPlaceForDetails,
      selectLayerPlaceForDrag,
      selectLayerPolyline,
      selectLayerPolylineForDetails,
      selectTripPolyline,
      selectSearchedGooglePlace,
      selectDay,
      toggleDayVisibility,
      updatePlaceStyle,
      updateTripPlaceTimeRange,
      updateTripPlaceMemo,
      updateTripPolylineMode,
      updateSelectedPolylineModes,
    ],
  );
}
