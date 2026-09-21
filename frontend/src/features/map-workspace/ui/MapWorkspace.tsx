import { useMemo, useRef } from 'react';
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
import { LayerPanel } from '@/features/map-workspace/components/layer-panel/LayerPanel';
import { useMapWorkspaceActions } from '@/features/map-workspace/model/useMapWorkspaceActions';
import { MapWorkspaceViewport } from '@/features/map-workspace/ui/MapWorkspaceViewport';
import { RenderProfiler } from '@/shared/lib/RenderProfiler';
import '@/features/map-workspace/styles/map.css';

export function MapWorkspace({
  onQueryRouteDuration,
}: {
  onQueryRouteDuration: QueryRouteDuration;
}) {
  const { trip, status, error } = useTripState();
  const controller = useTripEditController();
  useTripHistoryShortcuts(controller);
  const ui = useMapWorkspace(trip);
  const googlePlace = useSelectedGooglePlace();
  const sidebarRef = useRef<HTMLElement>(null);
  const tripView = useMemo(() => tripToView(trip), [trip]);
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
            trip={tripView}
            busy={mutationBusy}
            saveStatus={status}
            savedAt={trip.updatedAt}
            mutationError={error}
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
            {...actions.mapViewport}
          />
        </RenderProfiler>
      </main>
    </div>
  );
}
