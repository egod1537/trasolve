import { useMemo, useRef } from 'react';
import {
  selectTripPlace,
  selectTripPolyline,
} from '../domain/mapTripSelectors';
import type { QueryRouteDuration } from '../domain/routeDuration';
import { tripToView } from '../domain/tripMapping';
import { useMapUi } from '../hooks/useMapUi';
import { useSelectedGooglePlace } from '../hooks/useSelectedGooglePlace';
import { useTripEditController, useTripState } from '../hooks/useTrip';
import { LayerPanel } from './layer-panel/LayerPanel';
import { useMapWorkspaceActions } from './mapWorkspaceActions';
import { MapViewport } from './viewport/MapViewport';
import '../styles/map.css';

export function MapWorkspace({
  onQueryRouteDuration,
}: {
  onQueryRouteDuration: QueryRouteDuration;
}) {
  const { trip, status, error } = useTripState();
  const controller = useTripEditController();
  const ui = useMapUi(trip);
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
  const mutationBusy = status === 'saving';
  const actions = useMapWorkspaceActions(
    controller,
    ui,
    googlePlace,
    trip.days.length,
  );

  return (
    <div className="trip-map-workspace">
      <main className="trip-map-page">
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
        <MapViewport
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
      </main>
    </div>
  );
}
