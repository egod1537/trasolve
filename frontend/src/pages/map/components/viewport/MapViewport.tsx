import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from 'react';
import type {
  PlaceDetails,
  PlaceStyle,
  TripDay,
  TripPlace,
  TripPolyline,
  TripPolylineMode,
} from '@trasolve/shared';
import { AnchoredMapCard } from '../../../../map/components/AnchoredMapCard';
import type { GoogleMapHandle } from '../../../../map/types/googleMapComponent';
import type { GeoPoint } from '../../../../map/types/mapTypes';
import type { SelectedGooglePlace } from '../../domain/selectedGooglePlace';
import { MapAiRegion } from '../ai/MapAiRegion';
import { BottomContextPanel } from '../bottom-panel/BottomContextPanel';
import { LayerBulkActionBar } from '../bottom-panel/LayerBulkActionBar';
import { MapToolPanel } from '../bottom-panel/MapToolPanel';
import {
  RouteOptimizationModal,
  type RouteOptimizationOptions,
} from '../bottom-panel/RouteOptimizationModal';
import {
  getQuickSearchShortcutLabel,
  QuickSearch,
} from '../quick-search/QuickSearch';
import { GoogleMapView } from './GoogleMapView';
import { GooglePlaceCard } from './GooglePlaceCard';
import { MapSearchToolbar } from './MapSearchToolbar';
import { MapUserControls } from './MapUserControls';
import { TripPlaceCard } from './TripPlaceCard';
import { TripPolylineCard } from './TripPolylineCard';

type Props = Omit<
  ComponentProps<typeof GoogleMapView>,
  'mapRef' | 'overlay'
> & {
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
  onUpdateTripPlaceTimeRange: (
    placeId: string,
    time: string,
    durationMinutes: number,
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
  onOptimizeRoute?: (options: RouteOptimizationOptions) => Promise<void> | void;
};

type MapDetailTarget =
  { type: 'place'; id: string } | { type: 'polyline'; id: string } | null;

const MapViewportChrome = memo(function MapViewportChrome({
  dismissRevision,
  mapRef,
  onSelectPlace,
}: {
  dismissRevision: number;
  mapRef: RefObject<GoogleMapHandle | null>;
  onSelectPlace: (place: PlaceDetails) => void;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchShortcutLabel] = useState(getQuickSearchShortcutLabel);
  const openQuickSearch = useCallback(() => setQuickSearchOpen(true), []);
  const closeQuickSearch = useCallback(() => setQuickSearchOpen(false), []);
  const getSearchBias = useCallback(() => {
    const center = mapRef.current?.getCenter();
    return center ? { ...center, radiusMeters: 50000 } : undefined;
  }, [mapRef]);
  const selectPlace = useCallback(
    (place: PlaceDetails) => {
      mapRef.current?.panTo(place.location);
      onSelectPlace(place);
    },
    [mapRef, onSelectPlace],
  );

  return (
    <>
      <div className="map-viewport-tools">
        <MapSearchToolbar
          key={dismissRevision}
          aiOpen={aiOpen}
          quickSearchShortcutLabel={quickSearchShortcutLabel}
          getSearchBias={getSearchBias}
          onOpenQuickSearch={openQuickSearch}
          onSelectPlace={selectPlace}
        />
        {!aiOpen && <MapUserControls />}
      </div>
      <MapAiRegion open={aiOpen} onOpenChange={setAiOpen} />
      <QuickSearch
        open={quickSearchOpen}
        shortcutLabel={quickSearchShortcutLabel}
        onOpen={openQuickSearch}
        onClose={closeQuickSearch}
      />
    </>
  );
});

export const MapViewport = memo(function MapViewport({
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
  onUpdateTripPlaceTimeRange,
  onUpdateTripPlaceMemo,
  onRenameTripPlace,
  onUpdateTripPlaceStyle,
  onRemoveTripPlace,
  onCloseTripPolyline,
  onUpdateTripPolylineMode,
  onUpdateSelectedPolylineModes,
  onRemoveSelectedPlaces,
  onClearSelection,
  onOptimizeRoute,
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
  const [searchDismissRevision, setSearchDismissRevision] = useState(0);
  const [activeMapTool, setActiveMapTool] = useState<'pan'>('pan');
  const [routeOptimizationOpen, setRouteOptimizationOpen] = useState(false);
  const [mapDetailTarget, setMapDetailTarget] = useState<MapDetailTarget>(null);
  const routeToolButtonRef = useRef<HTMLButtonElement>(null);
  const routeOptimizationModalId = useId();
  const handleMapClick = useCallback(
    (event: Parameters<typeof onMapClick>[0]) => {
      setSearchDismissRevision((revision) => revision + 1);
      setMapDetailTarget(null);
      onMapClick(event);
    },
    [onMapClick],
  );
  const selectMapPlace = useCallback(
    (placeId: string) => {
      preserveNextSelectionRef.current = true;
      setMapDetailTarget({ type: 'place', id: placeId });
      onSelectPlace(placeId);
    },
    [onSelectPlace],
  );
  const selectMapPolyline = useCallback(
    (polylineId: string, anchor: GeoPoint) => {
      preserveNextSelectionRef.current = true;
      setMapDetailTarget({ type: 'polyline', id: polylineId });
      onSelectPolyline(polylineId, anchor);
    },
    [onSelectPolyline],
  );
  const closeTripPlace = useCallback(() => {
    setMapDetailTarget(null);
    onCloseTripPlace();
  }, [onCloseTripPlace]);
  const closeTripPolyline = useCallback(() => {
    setMapDetailTarget(null);
    onCloseTripPolyline();
  }, [onCloseTripPolyline]);

  useEffect(() => {
    if (previousSelectionRevisionRef.current === selectionRevision) return;
    previousSelectionRevisionRef.current = selectionRevision;
    if (preserveNextSelectionRef.current) {
      preserveNextSelectionRef.current = false;
      return;
    }
    setMapDetailTarget(null);
  }, [selectionRevision]);

  const activeDay =
    mapProps.trip.days.find((day) => day.id === mapProps.selectedDayId) ?? null;
  const bulkSelectedPlaceIds = useMemo(
    () => Array.from(selectedPlaceIds),
    [selectedPlaceIds],
  );
  const bulkSelectedPolylines = useMemo(
    () =>
      mapProps.trip.days.flatMap((day) =>
        day.polylines.filter((polyline) =>
          selectedPolylineIds.has(polyline.id),
        ),
      ),
    [mapProps.trip.days, selectedPolylineIds],
  );
  const closeRouteOptimization = useCallback(() => {
    setRouteOptimizationOpen(false);
    requestAnimationFrame(() => routeToolButtonRef.current?.focus());
  }, [setRouteOptimizationOpen]);

  const detailPlace =
    mapDetailTarget?.type === 'place' &&
    selectedTripPlace?.place.id === mapDetailTarget.id
      ? selectedTripPlace
      : null;
  const detailPolyline =
    mapDetailTarget?.type === 'polyline' &&
    selectedTripPolyline?.polyline.id === mapDetailTarget.id
      ? selectedTripPolyline
      : null;
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
        onUpdateTimeRange={onUpdateTripPlaceTimeRange}
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
        onUpdateMode={(mode) =>
          onUpdateTripPolylineMode(detailPolyline.polyline.id, mode)
        }
      />
    </AnchoredMapCard>
  ) : null;

  return (
    <div className="map-viewport">
      <GoogleMapView
        {...mapProps}
        sidebarRef={sidebarRef}
        mapRef={mapRef}
        onMapClick={handleMapClick}
        onSelectPlace={selectMapPlace}
        onSelectPolyline={selectMapPolyline}
        overlay={anchoredCard}
      />
      <div className="bottom-map-controls-positioner">
        <div
          className={`bottom-map-controls${
            selectedItemCount >= 2 ? ' has-bulk-selection' : ''
          }`}
        >
          {selectedItemCount >= 2 ? (
            <LayerBulkActionBar
              selectedPlaceIds={bulkSelectedPlaceIds}
              selectedPolylines={bulkSelectedPolylines}
              busy={tripMutationBusy}
              mutationError={tripMutationError}
              onUpdatePolylineModes={onUpdateSelectedPolylineModes}
              onDeletePlaces={onRemoveSelectedPlaces}
              onClearSelection={onClearSelection}
            />
          ) : (
            <BottomContextPanel activeDay={activeDay} />
          )}
          <MapToolPanel
            canUndo={false}
            canRedo={false}
            activeTool={activeMapTool}
            onUndo={() => undefined}
            onRedo={() => undefined}
            onSelectTool={setActiveMapTool}
            onOpenRouteTools={
              activeDay
                ? () => setRouteOptimizationOpen((open) => !open)
                : undefined
            }
            routeToolsOpen={routeOptimizationOpen && activeDay !== null}
            routeToolsControlId={routeOptimizationModalId}
            routeToolButtonRef={routeToolButtonRef}
          />
        </div>
      </div>
      <MapViewportChrome
        dismissRevision={searchDismissRevision}
        mapRef={mapRef}
        onSelectPlace={onSelectSearchedGooglePlace}
      />
      {routeOptimizationOpen && activeDay && (
        <RouteOptimizationModal
          id={routeOptimizationModalId}
          activeDay={activeDay}
          onClose={closeRouteOptimization}
          onOptimize={onOptimizeRoute}
        />
      )}
    </div>
  );
});
