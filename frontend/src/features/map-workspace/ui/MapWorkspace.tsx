import { useCallback, useMemo, useRef } from 'react';
import { selectTripPlace, selectTripPolyline } from '@/entities/trip';
import type { QueryRouteDuration } from '@/features/map-workspace/domain/routeDuration';
import { tripToView } from '@/entities/trip';
import { useMapWorkspace } from '@/features/map-workspace/model/useMapWorkspace';
import { useSelectedGooglePlace } from '@/features/place-editor';
import {
  useTripEditController,
  useTripState,
} from '@/features/map-workspace/hooks/useTrip';
import { useTripHistoryShortcuts } from '@/features/map-workspace/hooks/useTripHistoryShortcuts';
import { useTripHistoryState } from '@/features/map-workspace/hooks/useTripHistoryState';
import { LayerPanel } from '@/features/map-workspace/components/layer-panel/LayerPanel';
import { ReadonlyLayerPanel } from '@/features/map-workspace/components/layer-panel/ReadonlyLayerPanel';
import { useMapWorkspaceActions } from '@/features/map-workspace/model/useMapWorkspaceActions';
import { MapWorkspaceViewport } from '@/features/map-workspace/ui/MapWorkspaceViewport';
import { ReadonlyMapWorkspaceViewport } from '@/features/map-workspace/ui/ReadonlyMapWorkspaceViewport';
import { RenderProfiler } from '@/shared/lib/RenderProfiler';
import '@/features/map-workspace/styles/map.css';
import { useL } from '@/shared/i18n';

type Props =
  | {
      mode: 'edit';
      onQueryRouteDuration: QueryRouteDuration;
      onOpenTripPicker: () => void;
      debugMode: boolean;
    }
  | {
      mode: 'readonly';
      onQueryRouteDuration?: never;
      onOpenTripPicker?: never;
    };

export function MapWorkspace(props: Props) {
  return props.mode === 'readonly' ? (
    <ReadonlyMapWorkspace />
  ) : (
    <EditableMapWorkspace
      onQueryRouteDuration={props.onQueryRouteDuration}
      onOpenTripPicker={props.onOpenTripPicker}
      debugMode={props.debugMode}
    />
  );
}

function EditableMapWorkspace({
  onQueryRouteDuration,
  onOpenTripPicker,
  debugMode,
}: {
  onQueryRouteDuration: QueryRouteDuration;
  onOpenTripPicker: () => void;
  debugMode: boolean;
}) {
  const L = useL();
  const { trip, status, error } = useTripState();
  const controller = useTripEditController();
  const { canUndo, canRedo } = useTripHistoryState(controller);
  useTripHistoryShortcuts(controller);
  const ui = useMapWorkspace(trip);
  const googlePlace = useSelectedGooglePlace();
  const sidebarRef = useRef<HTMLElement>(null);
  const tripView = useMemo(
    () =>
      tripToView(trip, L('trip:tripMapping.tripToView.text.dateBeDetermined')),
    [L, trip],
  );
  const selectedTripPlace = useMemo(
    () => selectTripPlace(trip, ui.selectedPlaceId),
    [trip, ui.selectedPlaceId],
  );
  const selectedTripPolyline = useMemo(
    () =>
      selectTripPolyline(
        trip,
        ui.selectedPolylineId,
        ui.selectedPolylineAnchor,
      ),
    [trip, ui.selectedPolylineAnchor, ui.selectedPolylineId],
  );
  // Autosave runs in the background; persistence never blocks local editing.
  const mutationBusy = false;
  const undo = useCallback(() => void controller.undo(), [controller]);
  const redo = useCallback(() => void controller.redo(), [controller]);
  const actions = useMapWorkspaceActions(
    controller,
    ui,
    googlePlace,
    trip.days.length,
  );

  return (
    <div className="trip-map-workspace">
      <main className="trip-map-page">
        <RenderProfiler id="map-layer-panel">
          <LayerPanel
            tripId={trip.id}
            trip={tripView}
            busy={mutationBusy}
            saveStatus={status}
            savedAt={trip.updatedAt}
            mutationError={error}
            debugMode={debugMode}
            onQueryRouteDuration={onQueryRouteDuration}
            sidebarRef={sidebarRef}
            selectionRevision={ui.selectionRevision}
            selectedPlaceId={ui.selectedPlaceId}
            selectedPlaceIds={ui.selectedPlaceIds}
            selectedPolylineId={ui.selectedPolylineId}
            selectedPolylineIds={ui.selectedPolylineIds}
            selectedDayId={ui.selectedDayId}
            visibleDayIds={ui.visibleDayIds}
            {...actions.layerPanel}
          />
        </RenderProfiler>
        <RenderProfiler id="map-viewport">
          <MapWorkspaceViewport
            trip={trip}
            selectionRevision={ui.selectionRevision}
            focusTarget={ui.focusTarget}
            selectedPlaceId={ui.selectedPlaceId}
            selectedPolylineId={ui.selectedPolylineId}
            selectedDayId={ui.selectedDayId}
            visibleDayIds={ui.visibleDayIds}
            sidebarRef={sidebarRef}
            selectedGooglePlace={googlePlace.selection}
            selectedTripPlace={selectedTripPlace}
            selectedTripPolyline={selectedTripPolyline}
            selectedPlaceIds={ui.selectedPlaceIds}
            selectedPolylineIds={ui.selectedPolylineIds}
            selectedItemCount={ui.selectedItemCount}
            tripMutationBusy={mutationBusy}
            tripMutationError={error}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onOpenTripPicker={onOpenTripPicker}
            {...actions.mapViewport}
          />
        </RenderProfiler>
      </main>
    </div>
  );
}

function ReadonlyMapWorkspace() {
  const L = useL();
  const { trip } = useTripState();
  const ui = useMapWorkspace(trip);
  const sidebarRef = useRef<HTMLElement>(null);
  const tripView = useMemo(
    () =>
      tripToView(trip, L('trip:tripMapping.tripToView.text.dateBeDetermined')),
    [L, trip],
  );
  const selectedTripPlace = useMemo(
    () => selectTripPlace(trip, ui.selectedPlaceId),
    [trip, ui.selectedPlaceId],
  );
  const selectedTripPolyline = useMemo(
    () =>
      selectTripPolyline(
        trip,
        ui.selectedPolylineId,
        ui.selectedPolylineAnchor,
      ),
    [trip, ui.selectedPolylineAnchor, ui.selectedPolylineId],
  );
  const clearMapSelection = useCallback(() => ui.clearMapSelection(), [ui]);

  return (
    <div className="trip-map-workspace">
      <main className="trip-map-page">
        <RenderProfiler id="map-layer-panel-readonly">
          <ReadonlyLayerPanel
            trip={tripView}
            sidebarRef={sidebarRef}
            selectionRevision={ui.selectionRevision}
            selectedPlaceId={ui.selectedPlaceId}
            selectedPlaceIds={ui.selectedPlaceIds}
            selectedPolylineId={ui.selectedPolylineId}
            selectedPolylineIds={ui.selectedPolylineIds}
            selectedDayId={ui.selectedDayId}
            onSelectPlace={ui.selectPlaceWithModifiers}
            onSelectPlaceForDetails={ui.selectPlaceForDetails}
            onSelectPolyline={ui.selectPolylineWithModifiers}
            onSelectPolylineForDetails={ui.selectPolylineForDetails}
            onSelectDay={ui.selectDay}
          />
        </RenderProfiler>
        <RenderProfiler id="map-viewport-readonly">
          <ReadonlyMapWorkspaceViewport
            trip={trip}
            selectionRevision={ui.selectionRevision}
            focusTarget={ui.focusTarget}
            selectedPlaceId={ui.selectedPlaceId}
            selectedPolylineId={ui.selectedPolylineId}
            selectedDayId={ui.selectedDayId}
            visibleDayIds={ui.visibleDayIds}
            sidebarRef={sidebarRef}
            selectedTripPlace={selectedTripPlace}
            selectedTripPolyline={selectedTripPolyline}
            onSelectPlace={ui.selectPlace}
            onSelectPolyline={ui.selectPolyline}
            onMapClick={clearMapSelection}
            onClearSelection={clearMapSelection}
          />
        </RenderProfiler>
      </main>
    </div>
  );
}
