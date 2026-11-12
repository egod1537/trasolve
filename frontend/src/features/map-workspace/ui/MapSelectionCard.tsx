import type { RefObject } from 'react';
import { AnchoredMapCard } from '@/map/components/AnchoredMapCard';
import { GooglePlaceCard, TripPlaceCard } from '@/features/place-editor';
import { TripPolylineCard } from '../components/viewport/TripPolylineCard';
import type { MapDetailTarget } from '../model/mapWorkspaceStore';
import type { MapWorkspaceViewportProps } from './mapViewportProps';

type Props = Pick<
  MapWorkspaceViewportProps,
  | 'selectedGooglePlace'
  | 'selectedDayId'
  | 'selectedTripPlace'
  | 'selectedTripPolyline'
  | 'tripMutationBusy'
  | 'onCloseGooglePlace'
  | 'onRetryGooglePlace'
  | 'onAddGooglePlace'
  | 'onUpdateTripPlaceVisitTimeRange'
  | 'onUpdateTripPlacePreferredDuration'
  | 'onUpdateTripPlaceMemo'
  | 'onRenameTripPlace'
  | 'onUpdateTripPlaceStyle'
  | 'onRemoveTripPlace'
  | 'onUpdateTripPolylineMode'
  | 'onCloseTripPlace'
  | 'onCloseTripPolyline'
> & {
  enabled: boolean;
  target: MapDetailTarget;
  mutationError: string | null;
  occlusionRef: RefObject<HTMLElement | null>;
  cardRef: RefObject<HTMLElement | null>;
};

export function MapSelectionCard(props: Props) {
  const {
    selectedGooglePlace,
    selectedTripPlace,
    selectedTripPolyline,
    target,
  } = props;
  if (!props.enabled) {
    return null;
  }
  if (selectedGooglePlace) {
    return (
      <AnchoredMapCard
        anchorId={`google:${selectedGooglePlace.placeId}`}
        anchor={selectedGooglePlace.clickedLocation}
        occlusionRef={props.occlusionRef}
      >
        <GooglePlaceCard
          key={selectedGooglePlace.placeId}
          selection={selectedGooglePlace}
          activeDayId={props.selectedDayId}
          busy={props.tripMutationBusy}
          mutationError={props.mutationError}
          onClose={props.onCloseGooglePlace}
          onRetry={props.onRetryGooglePlace}
          onAddToTrip={props.onAddGooglePlace}
        />
      </AnchoredMapCard>
    );
  }
  if (target?.type === 'place' && selectedTripPlace?.place.id === target.id) {
    return (
      <AnchoredMapCard
        anchorId={`trip:${selectedTripPlace.place.id}`}
        anchor={selectedTripPlace.place.location}
        occlusionRef={props.occlusionRef}
      >
        <TripPlaceCard
          key={selectedTripPlace.place.id}
          cardRef={props.cardRef}
          day={selectedTripPlace.day}
          place={selectedTripPlace.place}
          busy={props.tripMutationBusy}
          mutationError={props.mutationError}
          onClose={props.onCloseTripPlace}
          onUpdateVisitTimeRange={props.onUpdateTripPlaceVisitTimeRange}
          onUpdatePreferredDuration={props.onUpdateTripPlacePreferredDuration}
          onUpdateMemo={props.onUpdateTripPlaceMemo}
          onRename={props.onRenameTripPlace}
          onUpdateStyle={props.onUpdateTripPlaceStyle}
          onRemove={props.onRemoveTripPlace}
        />
      </AnchoredMapCard>
    );
  }
  if (
    target?.type === 'polyline' &&
    selectedTripPolyline?.polyline.id === target.id
  ) {
    return (
      <AnchoredMapCard
        anchorId={`trip-polyline:${selectedTripPolyline.polyline.id}`}
        anchor={selectedTripPolyline.anchor}
        occlusionRef={props.occlusionRef}
      >
        <TripPolylineCard
          key={selectedTripPolyline.polyline.id}
          cardRef={props.cardRef}
          day={selectedTripPolyline.day}
          polyline={selectedTripPolyline.polyline}
          fromPlace={selectedTripPolyline.fromPlace}
          toPlace={selectedTripPolyline.toPlace}
          busy={props.tripMutationBusy}
          mutationError={props.mutationError}
          onClose={props.onCloseTripPolyline}
          onUpdateMode={(mode) =>
            props.onUpdateTripPolylineMode(
              selectedTripPolyline.polyline.id,
              mode,
            )
          }
        />
      </AnchoredMapCard>
    );
  }
  return null;
}
