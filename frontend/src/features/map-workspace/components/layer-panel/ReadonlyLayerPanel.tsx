import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import type {
  LayerItem,
  Trip,
  TripDay,
  TripPlace,
  TripPolyline,
} from '@/entities/trip';
import type { LayerSelectionModifiers } from '@/features/map-workspace/model/useMapWorkspace';
import { LayerItemChevron } from '@/features/map-workspace/components/layer-panel/LayerItemChevron';
import { LayerItemShell } from '@/features/map-workspace/components/layer-panel/LayerItemShell';
import { LayerTypeIcon } from '@/features/map-workspace/components/layer-panel/LayerTypeIcon';
import { PolylineLayerItem } from '@/features/map-workspace/components/layer-panel/PolylineLayerItem';
import { useLayerDetailCardPlacement } from '@/features/map-workspace/components/layer-panel/LayerDetailCard';
import { TripPolylineCard } from '@/features/map-workspace/components/viewport/TripPolylineCard';
import { PlaceDetailContent, PlaceTimeTimeline } from '@/features/place-editor';
import { formatDurationMinutes } from '@/shared/i18n/formatters';
import { useL } from '@/shared/i18n';

type DetailTarget =
  { type: 'place'; id: string } | { type: 'polyline'; id: string } | null;

type Props = {
  trip: Trip;
  sidebarRef: RefObject<HTMLElement | null>;
  selectionRevision: number;
  selectedPlaceId: string | null;
  selectedPlaceIds: ReadonlySet<string>;
  selectedPolylineId: string | null;
  selectedPolylineIds: ReadonlySet<string>;
  selectedDayId: string | null;
  onSelectPlace: (id: string, modifiers: LayerSelectionModifiers) => void;
  onSelectPlaceForDetails: (id: string) => void;
  onSelectPolyline: (id: string, modifiers: LayerSelectionModifiers) => void;
  onSelectPolylineForDetails: (id: string) => void;
  onSelectDay: (id: string) => void;
};

type RenderedLayerItem =
  | { type: 'place'; key: string; place: TripPlace }
  | { type: 'polyline'; key: string; polyline: TripPolyline };

function layerItemKey(item: LayerItem): string {
  return `${item.type}:${item.id}`;
}

function resolveLayerItems(day: TripDay): RenderedLayerItem[] {
  const places = new Map(day.places.map((place) => [place.id, place]));
  const polylines = new Map(
    day.polylines.map((polyline) => [polyline.id, polyline]),
  );
  return day.layerItems.flatMap((item): RenderedLayerItem[] => {
    const key = layerItemKey(item);
    if (item.type === 'place') {
      const place = places.get(item.id);
      return place ? [{ type: 'place', key, place }] : [];
    }
    const polyline = polylines.get(item.id);
    return polyline ? [{ type: 'polyline', key, polyline }] : [];
  });
}

function ReadonlyPlaceLayerItem({
  day,
  place,
  isLast,
  selected,
  detailsOpen,
  routeRole,
  onSelect,
  onOpenDetails,
}: {
  day: TripDay;
  place: TripPlace;
  isLast: boolean;
  selected: boolean;
  detailsOpen: boolean;
  routeRole?: 'start' | 'destination';
  onSelect: (id: string, modifiers: LayerSelectionModifiers) => void;
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

function ReadonlyPlaceDetail({
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

function ReadonlyPolylineDetail({
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

export const ReadonlyLayerPanel = memo(function ReadonlyLayerPanel({
  trip,
  sidebarRef,
  selectionRevision,
  selectedPlaceId,
  selectedPlaceIds,
  selectedPolylineId,
  selectedPolylineIds,
  selectedDayId,
  onSelectPlace,
  onSelectPlaceForDetails,
  onSelectPolyline,
  onSelectPolylineForDetails,
  onSelectDay,
}: Props) {
  const L = useL();
  const [expandedDayIds, setExpandedDayIds] = useState<Set<string>>(
    () => new Set(selectedDayId ? [selectedDayId] : []),
  );
  const [detailTarget, setDetailTarget] = useState<DetailTarget>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const placeCount = trip.days.reduce(
    (total, day) => total + day.places.length,
    0,
  );
  const detailPlaceContext = useMemo(
    () =>
      detailTarget?.type === 'place'
        ? trip.days
            .flatMap((day) => day.places.map((place) => ({ day, place })))
            .find(({ place }) => place.id === detailTarget.id)
        : undefined,
    [detailTarget, trip.days],
  );
  const detailPolylineContext = useMemo(
    () =>
      detailTarget?.type === 'polyline'
        ? trip.days
            .flatMap((day) =>
              day.polylines.flatMap((polyline) => {
                const fromPlace = day.places.find(
                  (place) => place.id === polyline.fromPlaceId,
                );
                const toPlace = day.places.find(
                  (place) => place.id === polyline.toPlaceId,
                );
                return fromPlace && toPlace
                  ? [{ day, polyline, fromPlace, toPlace }]
                  : [];
              }),
            )
            .find(({ polyline }) => polyline.id === detailTarget.id)
        : undefined,
    [detailTarget, trip.days],
  );
  const closeDetails = useCallback(() => setDetailTarget(null), []);
  const toggleDay = useCallback((dayId: string) => {
    setExpandedDayIds((current) => {
      const next = new Set(current);
      if (next.has(dayId)) {
        next.delete(dayId);
      } else {
        next.add(dayId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const selector = selectedPlaceId
      ? `[data-place-id="${CSS.escape(selectedPlaceId)}"]`
      : selectedPolylineId
        ? `[data-polyline-id="${CSS.escape(selectedPolylineId)}"]`
        : null;
    const selectedItem = selector
      ? scrollRef.current?.querySelector<HTMLElement>(selector)
      : null;
    selectedItem?.scrollIntoView({ block: 'nearest' });
  }, [selectedPlaceId, selectedPolylineId, selectionRevision]);

  return (
    <>
      <aside
        ref={sidebarRef}
        className="layer-panel trip-sidebar"
        aria-label={L('map:layerPanel.ariaLabel.travelItinerary')}
      >
        <header className="trip-sidebar-header">
          <div className="trip-panel-header-body">
            <div className="trip-panel-header-copy">
              <h1 className="trip-plan-title">
                <span className="trip-plan-title-text">{trip.title}</span>
              </h1>
              <p className="trip-panel-header-meta">
                {L('map:layerPanelHeader.text.dayPcsPlacePcs', {
                  length: trip.days.length,
                  placeCount,
                })}
              </p>
            </div>
          </div>
        </header>
        <div className="layer-panel-scroll trip-sidebar-scroll" ref={scrollRef}>
          {trip.days.map((day) => {
            const expanded = expandedDayIds.has(day.id);
            const layerItems = resolveLayerItems(day);
            const placeIds = layerItems.flatMap((item) =>
              item.type === 'place' ? [item.place.id] : [],
            );
            const startPlaceId = placeIds[0];
            const destinationPlaceId =
              placeIds.length > 1 ? placeIds.at(-1) : undefined;
            return (
              <section
                key={day.id}
                className={`day-layer-section trip-day${selectedDayId === day.id ? ' is-active' : ''}`}
                style={{ '--day-color': day.color } as CSSProperties}
                data-day-id={day.id}
                aria-labelledby={`title-${day.id}`}
              >
                <div className="trip-day-heading">
                  <span
                    className="trip-day-color-control is-readonly"
                    aria-hidden="true"
                  >
                    <span className="trip-day-color-swatch" />
                  </span>
                  <h2 id={`title-${day.id}`}>
                    <button
                      type="button"
                      onClick={() => onSelectDay(day.id)}
                      aria-pressed={selectedDayId === day.id}
                    >
                      <span className="trip-day-title-text">{day.title}</span>
                      <span className="trip-day-date">{day.date}</span>
                    </button>
                  </h2>
                  <LayerItemChevron
                    variant="day"
                    expanded={expanded}
                    controls={`layers-${day.id}`}
                    label={L('map:dayLayerSection.text.message', {
                      title: day.title,
                      value: expanded
                        ? L('map:dayLayerSection.text.fold')
                        : L('map:dayLayerSection.text.expand'),
                    })}
                    onClick={() => toggleDay(day.id)}
                  />
                </div>
                <ol
                  id={`layers-${day.id}`}
                  className="trip-layer-list"
                  hidden={!expanded}
                >
                  {layerItems.map((item, index) => {
                    const isLast = index === layerItems.length - 1;
                    if (item.type === 'polyline') {
                      return (
                        <PolylineLayerItem
                          key={item.key}
                          dayId={day.id}
                          polyline={item.polyline}
                          isLast={isLast}
                          fromPlace={day.places.find(
                            (place) => place.id === item.polyline.fromPlaceId,
                          )}
                          toPlace={day.places.find(
                            (place) => place.id === item.polyline.toPlaceId,
                          )}
                          selected={selectedPolylineIds.has(item.polyline.id)}
                          detailsOpen={
                            detailTarget?.type === 'polyline' &&
                            detailTarget.id === item.polyline.id
                          }
                          onSelect={onSelectPolyline}
                          onOpenDetails={(id) => {
                            onSelectPolylineForDetails(id);
                            setDetailTarget((current) =>
                              current?.type === 'polyline' && current.id === id
                                ? null
                                : { type: 'polyline', id },
                            );
                          }}
                        />
                      );
                    }
                    const routeRole =
                      startPlaceId === item.place.id
                        ? 'start'
                        : destinationPlaceId === item.place.id
                          ? 'destination'
                          : undefined;
                    return (
                      <ReadonlyPlaceLayerItem
                        key={item.key}
                        day={day}
                        place={item.place}
                        isLast={isLast}
                        selected={selectedPlaceIds.has(item.place.id)}
                        detailsOpen={
                          detailTarget?.type === 'place' &&
                          detailTarget.id === item.place.id
                        }
                        routeRole={routeRole}
                        onSelect={onSelectPlace}
                        onOpenDetails={(id) => {
                          onSelectPlaceForDetails(id);
                          setDetailTarget((current) =>
                            current?.type === 'place' && current.id === id
                              ? null
                              : { type: 'place', id },
                          );
                        }}
                      />
                    );
                  })}
                  {!layerItems.length && (
                    <li className="trip-empty-day">
                      {L('map:dayLayerSection.text.thereNoRegisteredItems')}
                    </li>
                  )}
                </ol>
              </section>
            );
          })}
          {!trip.days.length && (
            <p className="trip-empty-day">
              {L('map:layerPanelContent.description.thereNoTravelPlansYet')}
            </p>
          )}
        </div>
      </aside>
      {detailPlaceContext && (
        <ReadonlyPlaceDetail
          key={detailPlaceContext.place.id}
          day={detailPlaceContext.day}
          place={detailPlaceContext.place}
          sidebarRef={sidebarRef}
          onClose={closeDetails}
        />
      )}
      {detailPolylineContext && (
        <ReadonlyPolylineDetail
          key={detailPolylineContext.polyline.id}
          day={detailPolylineContext.day}
          polyline={detailPolylineContext.polyline}
          fromPlace={detailPolylineContext.fromPlace}
          toPlace={detailPolylineContext.toPlace}
          sidebarRef={sidebarRef}
          onClose={closeDetails}
        />
      )}
    </>
  );
});
