import { memo, useRef } from 'react';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import type { MapDetailSelection } from '../model/mapViewportTypes';
import { useMapViewportInteractions } from '../model/useMapViewportInteractions';
import type { MapCanvasProps } from './mapViewportProps';
import { AnchoredMapCard } from '@/map/components/AnchoredMapCard';
import { PlaceDetailContent } from '@/features/place-editor';
import { BottomContextPanel } from '@/features/map-workspace/components/bottom-panel/BottomContextPanel';
import { TripPolylineCard } from '@/features/map-workspace/components/viewport/TripPolylineCard';
import { selectActiveDay } from '@/features/map-workspace/model/selectors';
import { MapCanvas } from '@/features/map-workspace/ui/MapCanvas';

type Props = Omit<MapCanvasProps, 'mapRef' | 'overlay'> &
  MapDetailSelection & {
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
    const interactions = useMapViewportInteractions({
      trip: mapProps.trip,
      selectionRevision,
      onSelectPlace,
      onSelectPolyline,
      onMapClick,
      onCloseTripPlace: onClearSelection,
      onCloseTripPolyline: onClearSelection,
    });
    const {
      selectMapPlace,
      selectMapPolyline,
      handleMapClick,
      closeTripPlace: clearDetails,
    } = interactions;
    const detailTarget = interactions.transient.mapDetailTarget;

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
