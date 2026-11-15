import { memo, useCallback, useId, useMemo, useRef } from 'react';
import {
  RouteComparisonBar,
  type RouteComparisonData,
} from '@/features/route-optimization';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import { ViewportCommands } from '../command-console/ViewportCommands';
import { useMeasurement } from '../measurement/useMeasurement';
import { useTripError } from '../hooks/useTrip';
import { selectActiveDay, selectPolylines } from '../model/selectors';
import { useMapViewportInteractions } from '../model/useMapViewportInteractions';
import { MapCanvas } from './MapCanvas';
import { MapOverlayHost } from './MapOverlayHost';
import { MapToolbar } from './MapToolbar';
import { MapSelectionCard } from './MapSelectionCard';
import type { MapWorkspaceViewportProps } from './mapViewportProps';

export const MapWorkspaceViewport = memo(function MapWorkspaceViewport(
  props: MapWorkspaceViewportProps,
) {
  const { comparison, onCompare, trip, sidebarRef } = props;
  const tripMutationError = useTripError();
  const measurement = useMeasurement();
  const mapRef = useRef<GoogleMapHandle>(null);
  const selectedCardRef = useRef<HTMLElement>(null);
  const routeToolButtonRef = useRef<HTMLButtonElement>(null);
  const routeOptimizationModalId = useId();
  const interactions = useMapViewportInteractions({ ...props, measurement });
  const {
    transient,
    selectMapPlace,
    selectMapPolyline,
    handleMapClick,
    toggleRouteOptimization,
  } = interactions;
  const { closeRouteOptimization: closeOptimization } = interactions;
  const closeRouteOptimization = useCallback(() => {
    closeOptimization();
    requestAnimationFrame(() => routeToolButtonRef.current?.focus());
  }, [closeOptimization]);
  const showComparison = useCallback(
    (data: RouteComparisonData | null) => {
      onCompare(data);
      if (data && !data.live) {
        closeRouteOptimization();
      }
    },
    [onCompare, closeRouteOptimization],
  );
  const activeDay =
    props.selectedTripPlace?.day ??
    props.selectedTripPolyline?.day ??
    selectActiveDay(trip, props.selectedDayId);
  const selectedPlaceIds = useMemo(
    () => Array.from(props.selectedPlaceIds),
    [props.selectedPlaceIds],
  );
  const selectedPolylines = useMemo(
    () => selectPolylines(trip, props.selectedPolylineIds),
    [trip, props.selectedPolylineIds],
  );
  return (
    <div className="map-viewport">
      <ViewportCommands
        mapRef={mapRef}
        measurement={measurement}
        openOptimization={() => {
          if (!transient.routeOptimizationOpen) {
            toggleRouteOptimization();
          }
        }}
        onPreviewPlace={props.onSelectSearchedGooglePlace}
        onSelectSavedPlace={selectMapPlace}
      />
      <MapCanvas
        trip={trip}
        focusTarget={props.focusTarget}
        selectedPlaceId={props.selectedPlaceId}
        selectedPolylineId={props.selectedPolylineId}
        selectedDayId={props.selectedDayId}
        visibleDayIds={props.visibleDayIds}
        onFocusPlace={props.onFocusPlace}
        measurement={measurement}
        comparison={comparison?.data}
        comparisonMode={comparison?.mode}
        sidebarRef={sidebarRef}
        comparisonSidebarRef={props.comparisonSidebarRef}
        mapRef={mapRef}
        onMapClick={handleMapClick}
        onSelectPlace={selectMapPlace}
        onSelectPolyline={selectMapPolyline}
        overlay={
          <MapSelectionCard
            {...props}
            enabled={measurement.tool === 'pan'}
            target={transient.mapDetailTarget}
            mutationError={tripMutationError}
            occlusionRef={sidebarRef}
            cardRef={selectedCardRef}
            onCloseTripPlace={interactions.closeTripPlace}
            onCloseTripPolyline={interactions.closeTripPolyline}
          />
        }
      />
      <div
        style={{ display: comparison ? 'none' : 'contents' }}
        inert={comparison !== null}
      >
        <MapOverlayHost
          onCompare={showComparison}
          activeDay={activeDay}
          days={trip.days.filter((day) => props.visibleDayIds.has(day.id))}
          measurement={measurement}
          routeOptimizationOpen={transient.routeOptimizationOpen}
          routeOptimizationModalId={routeOptimizationModalId}
          routeToolButtonRef={routeToolButtonRef}
          selectedItemCount={props.selectedItemCount}
          selectedPlaceIds={selectedPlaceIds}
          selectedPolylines={selectedPolylines}
          busy={props.tripMutationBusy}
          mutationError={tripMutationError}
          canUndo={props.canUndo}
          canRedo={props.canRedo}
          onUndo={props.onUndo}
          onRedo={props.onRedo}
          onToggleRouteOptimization={toggleRouteOptimization}
          onCloseRouteOptimization={closeRouteOptimization}
          onUpdatePolylineModes={props.onUpdateSelectedPolylineModes}
          onDeletePlaces={props.onRemoveSelectedPlaces}
          onClearSelection={props.onClearSelection}
        />
        <MapToolbar
          suspended={comparison !== null}
          dismissRevision={transient.searchDismissRevision}
          mapRef={mapRef}
          selectedPlaceIds={selectedPlaceIds}
          onSelectPlace={props.onSelectSearchedGooglePlace}
          onOpenTripPicker={props.onOpenTripPicker}
          onMobileNavigate={() => {
            interactions.closeDetails();
            props.onCloseGooglePlace();
          }}
        />
      </div>
      {comparison && <RouteComparisonBar comparison={comparison} />}
    </div>
  );
});
