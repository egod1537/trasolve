import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import type { TripDay, TripPlace, TripPolyline } from '@trasolve/shared';
import type { GeoPoint } from '@/shared/types/mapTypes';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import { AnchoredMapCard } from '@/map/components/AnchoredMapCard';
import { PlaceDetailContent } from '@/features/place-editor';
import { BottomContextPanel } from '@/features/map-workspace/components/bottom-panel/BottomContextPanel';
import { TripPolylineCard } from '@/features/map-workspace/components/viewport/TripPolylineCard';
import { selectActiveDay } from '@/features/map-workspace/model/selectors';
import { MapCanvas } from '@/features/map-workspace/ui/MapCanvas';

type MapDetailTarget =
  { type: 'place'; id: string } | { type: 'polyline'; id: string } | null;

type Props = Omit<ComponentProps<typeof MapCanvas>, 'mapRef' | 'overlay'> & {
  selectionRevision: number;
  selectedTripPlace: { day: TripDay; place: TripPlace } | null;
  selectedTripPolyline: {
    day: TripDay;
    polyline: TripPolyline;
    fromPlace: TripPlace;
    toPlace: TripPlace;
    anchor: GeoPoint;
  } | null;
  onClearSelection: () => void;
};

export const ReadonlyMapWorkspaceViewport = memo(
  function ReadonlyMapWorkspaceViewport({
    selectionRevision,
    selectedTripPlace,
    selectedTripPolyline,
    onClearSelection,
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
    const [detailTarget, setDetailTarget] = useState<MapDetailTarget>(null);

    const selectMapPlace = useCallback(
      (placeId: string) => {
        preserveNextSelectionRef.current = true;
        setDetailTarget({ type: 'place', id: placeId });
        onSelectPlace(placeId);
      },
      [onSelectPlace],
    );
    const selectMapPolyline = useCallback(
      (polylineId: string, anchor: GeoPoint) => {
        preserveNextSelectionRef.current = true;
        setDetailTarget({ type: 'polyline', id: polylineId });
        onSelectPolyline(polylineId, anchor);
      },
      [onSelectPolyline],
    );
    const clearDetails = useCallback(() => {
      setDetailTarget(null);
      onClearSelection();
    }, [onClearSelection]);
    const handleMapClick = useCallback(
      (event: Parameters<typeof onMapClick>[0]) => {
        setDetailTarget(null);
        onMapClick(event);
      },
      [onMapClick],
    );

    useEffect(() => {
      if (previousSelectionRevisionRef.current === selectionRevision) {
        return;
      }
      previousSelectionRevisionRef.current = selectionRevision;
      if (preserveNextSelectionRef.current) {
        preserveNextSelectionRef.current = false;
        return;
      }
      setDetailTarget(null);
    }, [selectionRevision]);

    const detailPlace =
      detailTarget?.type === 'place' &&
      selectedTripPlace?.place.id === detailTarget.id
        ? selectedTripPlace
        : null;
    const detailPolyline =
      detailTarget?.type === 'polyline' &&
      selectedTripPolyline?.polyline.id === detailTarget.id
        ? selectedTripPolyline
        : null;
    const activeDay = selectActiveDay(mapProps.trip, mapProps.selectedDayId);
    const anchoredCard = detailPlace ? (
      <AnchoredMapCard
        anchorId={`trip:${detailPlace.place.id}`}
        anchor={detailPlace.place.location}
        occlusionRef={sidebarRef}
      >
        <PlaceDetailContent
          day={detailPlace.day}
          place={detailPlace.place}
          busy={false}
          mutationError={null}
          readOnly
          groupClassName="map-popup-card-group"
          cardRef={selectedCardRef}
          onClose={clearDetails}
        />
      </AnchoredMapCard>
    ) : detailPolyline ? (
      <AnchoredMapCard
        anchorId={`trip-polyline:${detailPolyline.polyline.id}`}
        anchor={detailPolyline.anchor}
        occlusionRef={sidebarRef}
      >
        <TripPolylineCard
          day={detailPolyline.day}
          polyline={detailPolyline.polyline}
          fromPlace={detailPolyline.fromPlace}
          toPlace={detailPolyline.toPlace}
          busy={false}
          mutationError={null}
          readOnly
          cardRef={selectedCardRef}
          onClose={clearDetails}
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
        <div className="bottom-map-controls-positioner">
          <div className="bottom-map-controls">
            <BottomContextPanel activeDay={activeDay} />
          </div>
        </div>
      </div>
    );
  },
);
