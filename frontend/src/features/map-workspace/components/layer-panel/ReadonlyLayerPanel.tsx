import { LayerPanelShell } from './LayerPanelShell';
import { ScrollArea } from '@/shared/ui/ScrollArea';
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
import type { Trip } from '@/entities/trip';
import { resolveLayerItems } from './dayLayerPresentation';
import type { LayerSelectionModifiers } from '@/features/map-workspace/model/useMapWorkspace';
import { LayerItemChevron } from '@/features/map-workspace/components/layer-panel/LayerItemChevron';
import { LayerVisibilityControl } from './LayerVisibilityControl';
import { PolylineLayerItem } from '@/features/map-workspace/components/layer-panel/PolylineLayerItem';
import { useL } from '@/shared/i18n';
import {
  ReadonlyPlaceLayerItem,
  ReadonlyPlaceDetail,
  ReadonlyPolylineDetail,
} from '@/features/map-workspace/components/layer-panel/ReadonlyLayerDetails';

type DetailTarget =
  { type: 'place'; id: string } | { type: 'polyline'; id: string } | null;

type Props = {
  trip: Trip;
  visibleDayIds: ReadonlySet<string>;
  onToggleAllDayVisibility: () => void;
  sidebarRef: RefObject<HTMLElement | null>;
  selectionRevision: number;
  selectedPlaceId: string | null;
  selectedPlaceIds: ReadonlySet<string>;
  selectedPolylineId: string | null;
  selectedPolylineIds: ReadonlySet<string>;
  selectedDayId: string | null;
  onSelectPlace: (id: string, modifiers: LayerSelectionModifiers) => void;
  onFocusPlace: (id: string) => void;
  onSelectPlaceForDetails: (id: string) => void;
  onSelectPolyline: (id: string, modifiers: LayerSelectionModifiers) => void;
  onSelectPolylineForDetails: (id: string) => void;
  onSelectDay: (id: string) => void;
};

export const ReadonlyLayerPanel = memo(function ReadonlyLayerPanel({
  trip,
  visibleDayIds,
  onToggleAllDayVisibility,
  sidebarRef,
  selectionRevision,
  selectedPlaceId,
  selectedPlaceIds,
  selectedPolylineId,
  selectedPolylineIds,
  selectedDayId,
  onSelectPlace,
  onFocusPlace,
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
            .filter((day) => visibleDayIds.has(day.id))
            .flatMap((day) => day.places.map((place) => ({ day, place })))
            .find(({ place }) => place.id === detailTarget.id)
        : undefined,
    [detailTarget, trip.days, visibleDayIds],
  );
  const detailPolylineContext = useMemo(
    () =>
      detailTarget?.type === 'polyline'
        ? trip.days
            .filter((day) => visibleDayIds.has(day.id))
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
    [detailTarget, trip.days, visibleDayIds],
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
      <LayerPanelShell sidebarRef={sidebarRef} title={trip.title}>
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
        <LayerVisibilityControl
          dayCount={trip.days.length}
          visibleCount={visibleDayIds.size}
          onToggle={onToggleAllDayVisibility}
        />
        <ScrollArea
          className="layer-panel-scroll trip-sidebar-scroll"
          viewportRef={scrollRef}
          contentClassName="trip-sidebar-scroll-content"
        >
          {trip.days.map((day) => {
            const expanded = expandedDayIds.has(day.id);
            const layerItems = expanded ? resolveLayerItems(day) : [];
            const placeIds = layerItems.flatMap((item) =>
              item.type === 'place' ? [item.place.id] : [],
            );
            const startPlaceId = placeIds[0];
            const destinationPlaceId =
              placeIds.length > 1 ? placeIds.at(-1) : undefined;
            return (
              <section
                key={day.id}
                className={`day-layer-section trip-day${selectedDayId === day.id ? ' is-active' : ''}${visibleDayIds.has(day.id) ? '' : ' is-hidden'}`}
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
                          fromPlace={item.fromPlace}
                          toPlace={item.toPlace}
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
                        onFocus={onFocusPlace}
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
                  {expanded && !layerItems.length && (
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
        </ScrollArea>
      </LayerPanelShell>
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
