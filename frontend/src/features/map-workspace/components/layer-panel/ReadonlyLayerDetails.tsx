import { type RefObject } from 'react';
import type { TripDay, TripPlace, TripPolyline } from '@/entities/trip';
import type { LayerSelectionModifiers } from '@/features/map-workspace/model/useMapWorkspace';
import { LayerItemChevron } from '@/features/map-workspace/components/layer-panel/LayerItemChevron';
import { LayerItemShell } from '@/features/map-workspace/components/layer-panel/LayerItemShell';
import { LayerTypeIcon } from '@/features/map-workspace/components/layer-panel/LayerTypeIcon';
import { useLayerDetailCardPlacement } from '@/features/map-workspace/components/layer-panel/LayerDetailCard';
import { TripPolylineCard } from '@/features/map-workspace/components/viewport/TripPolylineCard';
import { PlaceDetailContent, PlaceTimeTimeline } from '@/features/place-editor';
import { formatDurationMinutes } from '@/shared/i18n/formatters';
import { PinIcon } from '@/shared/ui/icons';
import { useL } from '@/shared/i18n';

export function ReadonlyPlaceLayerItem({
  day,
  place,
  isLast,
  selected,
  detailsOpen,
  routeRole,
  onSelect,
  onFocus,
  onOpenDetails,
}: {
  day: TripDay;
  place: TripPlace;
  isLast: boolean;
  selected: boolean;
  detailsOpen: boolean;
  routeRole?: 'start' | 'destination';
  onSelect: (id: string, modifiers: LayerSelectionModifiers) => void;
  onFocus: (id: string) => void;
  onOpenDetails: (id: string) => void;
}) {
  const L = useL();
  const openDetails = () => onOpenDetails(place.id);

  return (
    <LayerItemShell
      type="place"
      itemId={place.id}
      dayId={day.id}
      isLast={isLast}
      selected={selected}
      detailsOpen={detailsOpen}
      treeNodeVariant={routeRole}
      endpointRole={routeRole === 'destination' ? 'end' : routeRole}
      onOpenDetails={openDetails}
      chevron={
        <LayerItemChevron
          variant="item"
          expanded={detailsOpen}
          controls={detailsOpen ? 'layer-place-detail-card' : undefined}
          label={L('map:placeLayerItem.text.details', {
            name: place.name,
            value: detailsOpen
              ? L('common:action.close')
              : L('map:placeLayerItem.text.open'),
          })}
          detailControl
          onClick={(event) => {
            event.stopPropagation();
            openDetails();
          }}
        />
      }
    >
      <LayerTypeIcon type="place" />
      <button
        type="button"
        className="trip-layer-item-content trip-place"
        aria-pressed={selected}
        onDoubleClick={() => onFocus(place.id)}
        onClick={(event) =>
          onSelect(place.id, {
            additive: event.ctrlKey || event.metaKey,
            range: event.shiftKey,
          })
        }
      >
        <span className="trip-place-content">
          <span className="trip-place-name-row">
            <span className="trip-place-name">{place.name}</span>
            {place.orderLocked && (
              <span
                className="trip-place-order-lock is-readonly"
                title={L(
                  'routeOptimization:routeComparisonMap.text.currentVisitOrder',
                )}
              >
                <PinIcon />
              </span>
            )}
            {place.preferredDurationMinutes !== undefined && (
              <span className="trip-place-stay-duration">
                {L('map:placeLayerItem.text.stay', {
                  formatDurationMinutes: formatDurationMinutes(
                    place.preferredDurationMinutes,
                    L,
                  ),
                })}
              </span>
            )}
          </span>
          <PlaceTimeTimeline
            time={place.time}
            visitDurationMinutes={
              place.preferredDurationMinutes ?? place.visitDurationMinutes
            }
            openingHours={place.openingHours}
            variant="compact"
          />
        </span>
      </button>
    </LayerItemShell>
  );
}

export function ReadonlyPlaceDetail({
  day,
  place,
  sidebarRef,
  onClose,
}: {
  day: TripDay;
  place: TripPlace;
  sidebarRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const style = useLayerDetailCardPlacement({
    anchorKey: `place:${place.id}`,
    sidebarRef,
    onClose,
    width: 442,
  });
  return (
    <PlaceDetailContent
      day={day}
      place={place}
      busy={false}
      mutationError={null}
      readOnly
      groupClassName="map-popup-card-group layer-place-detail-card-group"
      groupStyle={style}
      layerDetail
      onClose={onClose}
    />
  );
}

export function ReadonlyPolylineDetail({
  day,
  polyline,
  fromPlace,
  toPlace,
  sidebarRef,
  onClose,
}: {
  day: TripDay;
  polyline: TripPolyline;
  fromPlace: TripPlace;
  toPlace: TripPlace;
  sidebarRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const style = useLayerDetailCardPlacement({
    anchorKey: `polyline:${polyline.id}`,
    sidebarRef,
    onClose,
    width: 442,
  });
  return (
    <TripPolylineCard
      day={day}
      polyline={polyline}
      fromPlace={fromPlace}
      toPlace={toPlace}
      busy={false}
      mutationError={null}
      readOnly
      groupClassName="map-popup-card-group layer-place-detail-card-group"
      groupStyle={style}
      layerDetail
      onClose={onClose}
    />
  );
}
