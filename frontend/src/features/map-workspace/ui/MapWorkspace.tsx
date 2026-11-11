import { CommandSession } from '../command-console/CommandSession';
import { useTripData } from '@/features/map-workspace/hooks/useTrip';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTutorial } from '@/features/onboarding';
import { RouteComparisonSidebar } from '@/features/route-optimization';
import { useRouteComparison } from '@/features/map-workspace/model/useRouteComparison';
import { selectTripPlace, selectTripPolyline } from '@/entities/trip';
import type { QueryRouteDetails } from '@/features/map-workspace/domain/routeDetails';
import { createTripViewMapper } from '@/entities/trip';
import { useMapWorkspace } from '@/features/map-workspace/model/useMapWorkspace';
import { useSelectedGooglePlace } from '@/features/place-editor';
import { useTripEditController } from '@/features/map-workspace/hooks/useTrip';
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
      onQueryRouteDetails: QueryRouteDetails;
      onOpenTripPicker: () => void;
      debugMode: boolean;
    }
  | {
      mode: 'readonly';
      onQueryRouteDetails?: never;
      onOpenTripPicker?: never;
    };

export function MapWorkspace(props: Props) {
  return props.mode === 'readonly' ? (
    <ReadonlyMapWorkspace />
  ) : (
    <EditableMapWorkspace
      onQueryRouteDetails={props.onQueryRouteDetails}
      onOpenTripPicker={props.onOpenTripPicker}
    />
  );
}

function EditableMapWorkspace({
  onQueryRouteDetails,
  onOpenTripPicker,
}: {
  onQueryRouteDetails: QueryRouteDetails;
  onOpenTripPicker: () => void;
}) {
  const L = useL();
  const trip = useTripData();
  const tutorial = useTutorial();
  const tutorialDayCount = useRef(trip.days.length);
  useEffect(() => {
    if (
      tutorial?.active &&
      ['search', 'add-place'].includes(tutorial.progress.step) &&
      !trip.days.some((day) => !day.hidden)
    ) {
      tutorial.step(1);
    }
    if (
      tutorial?.active &&
      tutorial.progress.step === 'days' &&
      trip.days.length > tutorialDayCount.current
    ) {
      tutorial.completeStep('days');
    }
    tutorialDayCount.current = trip.days.length;
  }, [tutorial, trip.days]);
  const controller = useTripEditController();
  const { canUndo, canRedo } = useTripHistoryState(controller);
  const ui = useMapWorkspace(trip, controller);
  const comparison = useRouteComparison(trip, controller, ui.selectDay);
  useTripHistoryShortcuts(controller, comparison.view === null);
  const googlePlace = useSelectedGooglePlace();
  const sidebarRef = useRef<HTMLElement>(null);
  const comparisonSidebarRef = useRef<HTMLElement>(null);
  const tripToView = useMemo(() => createTripViewMapper(), []);
  const tripView = useMemo(
    () =>
      tripToView(trip, L('trip:tripMapping.tripToView.text.dateBeDetermined')),
    [L, trip, tripToView],
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
    <CommandSession trip={trip} controller={controller} ui={ui}>
      <div className="trip-map-workspace">
        <main className="trip-map-page">
          <div
            hidden={comparison.view !== null}
            inert={comparison.view !== null}
          >
            <RenderProfiler id="map-layer-panel">
              <LayerPanel
                tripId={trip.id}
                trip={tripView}
                busy={mutationBusy}
                onQueryRouteDetails={onQueryRouteDetails}
                sidebarRef={sidebarRef}
                selectionRevision={ui.selectionRevision}
                selectedPlaceId={ui.selectedPlaceId}
                selectedPlaceIds={ui.selectedPlaceIds}
                selectedPolylineId={ui.selectedPolylineId}
                selectedPolylineIds={ui.selectedPolylineIds}
                selectedDayId={ui.selectedDayId}
                visibleDayIds={ui.visibleDayIds}
                onToggleAllDayVisibility={ui.toggleAllDayVisibility}
                onFocusPlace={ui.focusPlace}
                {...actions.layerPanel}
              />
            </RenderProfiler>
          </div>
          {comparison.view && (
            <RouteComparisonSidebar
              comparison={comparison.view}
              sidebarRef={comparisonSidebarRef}
            />
          )}
          <RenderProfiler id="map-viewport">
            <MapWorkspaceViewport
              comparison={comparison.view}
              onCompare={comparison.onCompare}
              trip={trip}
              selectionRevision={ui.selectionRevision}
              focusTarget={ui.focusTarget}
              selectedPlaceId={ui.selectedPlaceId}
              selectedPolylineId={ui.selectedPolylineId}
              selectedDayId={ui.selectedDayId}
              visibleDayIds={ui.visibleDayIds}
              sidebarRef={sidebarRef}
              comparisonSidebarRef={comparisonSidebarRef}
              selectedGooglePlace={googlePlace.selection}
              selectedTripPlace={selectedTripPlace}
              selectedTripPolyline={selectedTripPolyline}
              selectedPlaceIds={ui.selectedPlaceIds}
              selectedPolylineIds={ui.selectedPolylineIds}
              selectedItemCount={ui.selectedItemCount}
              tripMutationBusy={mutationBusy}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onOpenTripPicker={onOpenTripPicker}
              onFocusPlace={ui.focusPlace}
              {...actions.mapViewport}
            />
          </RenderProfiler>
        </main>
      </div>
    </CommandSession>
  );
}

function ReadonlyMapWorkspace() {
  const L = useL();
  const trip = useTripData();
  const ui = useMapWorkspace(trip);
  const sidebarRef = useRef<HTMLElement>(null);
  const tripToView = useMemo(() => createTripViewMapper(), []);
  const tripView = useMemo(
    () =>
      tripToView(trip, L('trip:tripMapping.tripToView.text.dateBeDetermined')),
    [L, trip, tripToView],
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
            visibleDayIds={ui.visibleDayIds}
            onToggleAllDayVisibility={ui.toggleAllDayVisibility}
            sidebarRef={sidebarRef}
            selectionRevision={ui.selectionRevision}
            selectedPlaceId={ui.selectedPlaceId}
            selectedPlaceIds={ui.selectedPlaceIds}
            selectedPolylineId={ui.selectedPolylineId}
            selectedPolylineIds={ui.selectedPolylineIds}
            selectedDayId={ui.selectedDayId}
            onFocusPlace={ui.focusPlace}
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
            onFocusPlace={ui.focusPlace}
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
