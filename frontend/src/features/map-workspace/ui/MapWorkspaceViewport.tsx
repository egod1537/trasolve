import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  type ComponentProps,
} from 'react';
import type {
  PlaceDetails,
  PlaceStyle,
  TripDay,
  TripPlace,
  TripPolyline,
  TripPolylineMode,
} from '@trasolve/shared';
import { AnchoredMapCard } from '@/map/components/AnchoredMapCard';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import type { GeoPoint } from '@/shared/types/mapTypes';
import type { SelectedGooglePlace } from '@/entities/place';
import { MapCanvas } from '@/features/map-workspace/ui/MapCanvas';
import { GooglePlaceCard } from '@/features/place-editor';
import { TripPlaceCard } from '@/features/place-editor';
import { TripPolylineCard } from '@/features/map-workspace/components/viewport/TripPolylineCard';
import { MapToolbar } from '@/features/map-workspace/ui/MapToolbar';
import { MapOverlayHost } from '@/features/map-workspace/ui/MapOverlayHost';
import {
  initialMapWorkspaceTransientState,
  reduceMapWorkspaceTransientState,
} from '@/features/map-workspace/model/mapWorkspaceStore';
import {
  selectActiveDay,
  selectPolylines,
} from '@/features/map-workspace/model/selectors';

type Props = Omit<ComponentProps<typeof MapCanvas>, 'mapRef' | 'overlay'> & {
  selectionRevision: number;
  selectedGooglePlace: SelectedGooglePlace;
  onSelectSearchedGooglePlace: (place: PlaceDetails) => void;
  onCloseGooglePlace: () => void;
  onAddGooglePlace: (dayId: string, place: PlaceDetails) => Promise<boolean>;
  selectedTripPlace: { day: TripDay; place: TripPlace } | null;
  selectedTripPolyline: {
    day: TripDay;
    polyline: TripPolyline;
    fromPlace: TripPlace;
    toPlace: TripPlace;
    anchor: GeoPoint;
  } | null;
  selectedPlaceIds: ReadonlySet<string>;
  selectedPolylineIds: ReadonlySet<string>;
  selectedItemCount: number;
  tripMutationBusy: boolean;
  tripMutationError: string | null;
  onCloseTripPlace: () => void;
  onUpdateTripPlaceVisitTimeRange: (
    placeId: string,
    time: string,
    visitDurationMinutes: number,
  ) => Promise<boolean>;
  onUpdateTripPlacePreferredDuration: (
    placeId: string,
    preferredDurationMinutes: number,
  ) => Promise<boolean>;
  onUpdateTripPlaceMemo: (placeId: string, memo: string) => Promise<boolean>;
  onRenameTripPlace: (placeId: string, name: string) => Promise<boolean>;
  onUpdateTripPlaceStyle: (placeId: string, style: PlaceStyle) => void;
  onRemoveTripPlace: (placeId: string) => Promise<boolean>;
  onCloseTripPolyline: () => void;
  onUpdateTripPolylineMode: (
    polylineId: string,
    mode: TripPolylineMode,
  ) => Promise<boolean>;
  onUpdateSelectedPolylineModes: (
    polylineIds: readonly string[],
    mode: TripPolylineMode,
  ) => Promise<boolean>;
  onRemoveSelectedPlaces: (placeIds: readonly string[]) => Promise<boolean>;
  onClearSelection: () => void;
  onApplyOptimizedRoute: (
    dayId: string,
    placeIds: readonly string[],
  ) => Promise<boolean>;
};

export const MapWorkspaceViewport = memo(function MapWorkspaceViewport({
  selectionRevision,
  selectedGooglePlace,
  onSelectSearchedGooglePlace,
  onCloseGooglePlace,
  onAddGooglePlace,
  selectedTripPlace,
  selectedTripPolyline,
  selectedPlaceIds,
  selectedPolylineIds,
  selectedItemCount,
  tripMutationBusy,
  tripMutationError,
  onCloseTripPlace,
  onUpdateTripPlaceVisitTimeRange,
  onUpdateTripPlacePreferredDuration,
  onUpdateTripPlaceMemo,
  onRenameTripPlace,
  onUpdateTripPlaceStyle,
  onRemoveTripPlace,
  onCloseTripPolyline,
  onUpdateTripPolylineMode,
  onUpdateSelectedPolylineModes,
  onRemoveSelectedPlaces,
  onClearSelection,
  onApplyOptimizedRoute,
  onSelectPlace,
  onSelectPolyline,
  onMapClick,
  sidebarRef,
  ...mapProps
}: Props) {
  const mapRef = useRef<GoogleMapHandle>(null);
  const selectedCardRef = useRef<HTMLElement>(null);
  const preserveNextSelectionRef = useRef(false);
  const previousSelectionRevisionRef = useRef(selectionRevision);
  const [transient, dispatchTransient] = useReducer(
    reduceMapWorkspaceTransientState,
    initialMapWorkspaceTransientState,
  );
  const routeToolButtonRef = useRef<HTMLButtonElement>(null);
  const routeOptimizationModalId = useId();
  const handleMapClick = useCallback(
    (event: Parameters<typeof onMapClick>[0]) => {
      dispatchTransient({ type: 'map-clicked' });
      onMapClick(event);
    },
    [dispatchTransient, onMapClick],
  );
  const selectMapPlace = useCallback(
    (placeId: string) => {
      preserveNextSelectionRef.current = true;
      dispatchTransient({
        type: 'detail-selected',
        target: { type: 'place', id: placeId },
      });
      onSelectPlace(placeId);
    },
    [dispatchTransient, onSelectPlace],
  );
  const selectMapPolyline = useCallback(
    (polylineId: string, anchor: GeoPoint) => {
      preserveNextSelectionRef.current = true;
      dispatchTransient({
        type: 'detail-selected',
        target: { type: 'polyline', id: polylineId },
      });
      onSelectPolyline(polylineId, anchor);
    },
    [dispatchTransient, onSelectPolyline],
  );
  const closeTripPlace = useCallback(() => {
    dispatchTransient({ type: 'detail-closed' });
    onCloseTripPlace();
  }, [dispatchTransient, onCloseTripPlace]);
  const closeTripPolyline = useCallback(() => {
    dispatchTransient({ type: 'detail-closed' });
    onCloseTripPolyline();
  }, [dispatchTransient, onCloseTripPolyline]);

  useEffect(() => {
    if (previousSelectionRevisionRef.current === selectionRevision) {
      return;
    }
    previousSelectionRevisionRef.current = selectionRevision;
    if (preserveNextSelectionRef.current) {
      preserveNextSelectionRef.current = false;
      return;
    }
    dispatchTransient({ type: 'detail-closed' });
  }, [selectionRevision]);

  const activeDay = selectActiveDay(mapProps.trip, mapProps.selectedDayId);
  const bulkSelectedPlaceIds = useMemo(
    () => Array.from(selectedPlaceIds),
    [selectedPlaceIds],
  );
  const bulkSelectedPolylines = useMemo(
    () => selectPolylines(mapProps.trip, selectedPolylineIds),
    [mapProps.trip, selectedPolylineIds],
  );
  const closeRouteOptimization = useCallback(() => {
    dispatchTransient({ type: 'route-optimization-closed' });
    requestAnimationFrame(() => routeToolButtonRef.current?.focus());
  }, [dispatchTransient]);
  const toggleRouteOptimization = useCallback(
    () => dispatchTransient({ type: 'route-optimization-toggled' }),
    [dispatchTransient],
  );

  const detailPlace =
    transient.mapDetailTarget?.type === 'place' &&
    selectedTripPlace?.place.id === transient.mapDetailTarget.id
      ? selectedTripPlace
      : null;
  const detailPolyline =
    transient.mapDetailTarget?.type === 'polyline' &&
    selectedTripPolyline?.polyline.id === transient.mapDetailTarget.id
      ? selectedTripPolyline
      : null;
  const updateDetailPolylineMode = useCallback(
    (mode: TripPolylineMode) => {
      if (!detailPolyline) {
        return Promise.resolve(false);
      }
      return onUpdateTripPolylineMode(detailPolyline.polyline.id, mode);
    },
    [detailPolyline, onUpdateTripPolylineMode],
  );
  const selectMapTool = useCallback(
    (tool: 'pan') => dispatchTransient({ type: 'map-tool-selected', tool }),
    [dispatchTransient],
  );
  const anchoredCard = selectedGooglePlace ? (
    <AnchoredMapCard
      anchorId={`google:${selectedGooglePlace.placeId}`}
      anchor={
        selectedGooglePlace.status === 'loaded'
          ? selectedGooglePlace.place.location
          : selectedGooglePlace.clickedLocation
      }
      occlusionRef={sidebarRef}
    >
      <GooglePlaceCard
        key={selectedGooglePlace.placeId}
        selection={selectedGooglePlace}
        activeDayId={mapProps.selectedDayId}
        busy={tripMutationBusy}
        mutationError={tripMutationError}
        onClose={onCloseGooglePlace}
        onAddToTrip={onAddGooglePlace}
      />
    </AnchoredMapCard>
  ) : detailPlace ? (
    <AnchoredMapCard
      anchorId={`trip:${detailPlace.place.id}`}
      anchor={detailPlace.place.location}
      occlusionRef={sidebarRef}
    >
      <TripPlaceCard
        key={detailPlace.place.id}
        cardRef={selectedCardRef}
        day={detailPlace.day}
        place={detailPlace.place}
        busy={tripMutationBusy}
        mutationError={tripMutationError}
        onClose={closeTripPlace}
        onUpdateVisitTimeRange={onUpdateTripPlaceVisitTimeRange}
        onUpdatePreferredDuration={onUpdateTripPlacePreferredDuration}
        onUpdateMemo={onUpdateTripPlaceMemo}
        onRename={onRenameTripPlace}
        onUpdateStyle={onUpdateTripPlaceStyle}
        onRemove={onRemoveTripPlace}
      />
    </AnchoredMapCard>
  ) : detailPolyline ? (
    <AnchoredMapCard
      anchorId={`trip-polyline:${detailPolyline.polyline.id}`}
      anchor={detailPolyline.anchor}
      occlusionRef={sidebarRef}
    >
      <TripPolylineCard
        key={detailPolyline.polyline.id}
        cardRef={selectedCardRef}
        day={detailPolyline.day}
        polyline={detailPolyline.polyline}
        fromPlace={detailPolyline.fromPlace}
        toPlace={detailPolyline.toPlace}
        busy={tripMutationBusy}
        mutationError={tripMutationError}
        onClose={closeTripPolyline}
        onUpdateMode={updateDetailPolylineMode}
      />
    </AnchoredMapCard>
  ) : null;

  return (
    <div className="map-viewport">
      <MapCanvas
        {...mapProps}
        sidebarRef={sidebarRef}
        mapRef={mapRef}
        onMapClick={handleMapClick}
        onSelectPlace={selectMapPlace}
        onSelectPolyline={selectMapPolyline}
        overlay={anchoredCard}
      />
      <MapOverlayHost
        activeDay={activeDay}
        days={mapProps.trip.days}
        activeMapTool={transient.activeMapTool}
        routeOptimizationOpen={transient.routeOptimizationOpen}
        routeOptimizationModalId={routeOptimizationModalId}
        routeToolButtonRef={routeToolButtonRef}
        selectedItemCount={selectedItemCount}
        selectedPlaceIds={bulkSelectedPlaceIds}
        selectedPolylines={bulkSelectedPolylines}
        busy={tripMutationBusy}
        mutationError={tripMutationError}
        onSelectMapTool={selectMapTool}
        onToggleRouteOptimization={toggleRouteOptimization}
        onCloseRouteOptimization={closeRouteOptimization}
        onUpdatePolylineModes={onUpdateSelectedPolylineModes}
        onDeletePlaces={onRemoveSelectedPlaces}
        onClearSelection={onClearSelection}
        onApplyOptimizedRoute={onApplyOptimizedRoute}
      />
      <MapToolbar
        dismissRevision={transient.searchDismissRevision}
        mapRef={mapRef}
        onSelectPlace={onSelectSearchedGooglePlace}
      />
    </div>
  );
});
