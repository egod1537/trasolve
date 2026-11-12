import { useMobileDetailSelection } from '../../model/MobileNavigation';
import { LayerPanelShell } from './LayerPanelShell';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { PlaceStyle, TripPolylineMode } from '@trasolve/shared';
import type { QueryRouteDetails } from '@/features/map-workspace/domain/routeDetails';
import type { LayerValidationByItemKey, Trip } from '@/entities/trip';
import { RouteSettingsCard } from '@/features/map-workspace/components/RouteSettingsCard';
import type { SelectionProps } from '@/features/map-workspace/components/layer-panel/DayLayerSection';
import { LayerPanelHeader } from '@/features/map-workspace/components/layer-panel/LayerPanelHeader';
import { findPlaceContext, findPolylineContext } from './dayLayerPresentation';
import { LayerVisibilityControl } from './LayerVisibilityControl';
import { LayerPanelContent } from '@/features/map-workspace/components/layer-panel/LayerPanelContent';
import { LayerPlaceDetailCard } from '@/features/map-workspace/components/layer-panel/LayerPlaceDetailCard';
import { ShareTripModal } from '@/features/map-workspace/components/share/ShareTripModal';
import { useTripError } from '@/features/map-workspace/hooks/useTrip';
import { useEventCallback } from '@/shared/lib/useEventCallback';
import { DayDeleteDialog } from './DayDeleteDialog';

type DetailTarget =
  { type: 'place'; id: string } | { type: 'polyline'; id: string } | null;

type Props = SelectionProps & {
  tripId: string;
  trip: Trip;
  busy: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  onAddLayer: () => void;
  onToggleAllDayVisibility: () => void;
  onRenameTrip: (title: string) => void;
  onMoveDay: (dayId: string, targetIndex: number) => void;
  onRenameDay: (dayId: string, title: string) => void;
  onUpdateDayColor: (dayId: string, color: string) => void;
  onMovePlace: (
    placeId: string,
    targetDayId: string,
    targetIndex: number,
  ) => void;
  onRemoveDay: (dayId: string) => Promise<boolean>;
  onShuffleDayPlaces: (dayId: string) => void;
  onRenamePlace: (placeId: string, name: string) => Promise<boolean>;
  onUpdatePolylineMode: (
    polylineId: string,
    mode: TripPolylineMode,
  ) => Promise<boolean>;
  onQueryRouteDetails: QueryRouteDetails;
  onUpdatePlaceVisitTimeRange: (
    placeId: string,
    time: string,
    visitDurationMinutes: number,
  ) => Promise<boolean>;
  onUpdatePlacePreferredDuration: (
    placeId: string,
    preferredDurationMinutes: number,
  ) => Promise<boolean>;
  onUpdatePlaceMemo: (placeId: string, memo: string) => Promise<boolean>;
  onRemovePlace: (placeId: string) => Promise<boolean>;
  onUpdatePlaceStyle: (placeId: string, style: PlaceStyle) => void;
  onUpdatePlaceOrderLock: (placeId: string, locked: boolean) => void;
  validationByItemKey?: LayerValidationByItemKey;
  selectionRevision: number;
};

export const LayerPanel = memo(function LayerPanel({
  tripId,
  trip,
  busy,
  sidebarRef,
  onAddLayer,
  onToggleAllDayVisibility,
  onRenameTrip,
  onUpdatePlaceVisitTimeRange,
  onUpdatePlacePreferredDuration,
  onUpdatePlaceMemo,
  onRenamePlace,
  onUpdatePlaceStyle,
  onUpdatePlaceOrderLock,
  onRemovePlace,
  onRemoveDay,
  onUpdatePolylineMode,
  onQueryRouteDetails,
  onFocusPlace: focusPlace,
  onSelectPlace,
  onSelectPlaceForDetails,
  onSelectPolyline,
  onSelectPolylineForDetails,
  selectedPlaceIds,
  selectedPolylineIds,
  visibleDayIds,
  ...contentProps
}: Props) {
  const mutationError = useTripError();
  const onFocusPlace = useEventCallback(focusPlace);
  const [detailTarget, setDetailTarget] =
    useMobileDetailSelection<NonNullable<DetailTarget>>();
  const [deleteDay, setDeleteDay] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const detailPlaceId = detailTarget?.type === 'place' ? detailTarget.id : null;
  const detailPolylineId =
    detailTarget?.type === 'polyline' ? detailTarget.id : null;
  const detailPlaceContext = useMemo(
    () => findPlaceContext(trip.days, visibleDayIds, detailPlaceId),
    [detailPlaceId, trip.days, visibleDayIds],
  );
  const detailPolylineContext = useMemo(
    () => findPolylineContext(trip.days, visibleDayIds, detailPolylineId),
    [detailPolylineId, trip.days, visibleDayIds],
  );
  const detailOpen = !!detailPlaceContext || !!detailPolylineContext;
  const closeDetails = useCallback(
    () => setDetailTarget(null),
    [setDetailTarget],
  );
  const openShareModal = useCallback(() => setShareModalOpen(true), []);
  const closeShareModal = useCallback(() => {
    setShareModalOpen(false);
    requestAnimationFrame(() => shareButtonRef.current?.focus());
  }, []);
  const selectPlaceFromRow = useEventCallback<
    Parameters<SelectionProps['onSelectPlace']>,
    void
  >((placeId, modifiers) => {
    setDetailTarget(null);
    onSelectPlace(placeId, modifiers);
  });
  const selectPolylineFromRow = useEventCallback<
    Parameters<SelectionProps['onSelectPolyline']>,
    void
  >((polylineId, modifiers) => {
    setDetailTarget(null);
    onSelectPolyline(polylineId, modifiers);
  });
  const openPlaceDetails = useEventCallback((placeId: string) => {
    onSelectPlaceForDetails(placeId);
    setDetailTarget((current) =>
      current?.type === 'place' && current.id === placeId
        ? null
        : { type: 'place', id: placeId },
    );
  });
  const openPolylineDetails = useEventCallback((polylineId: string) => {
    onSelectPolylineForDetails(polylineId);
    setDetailTarget((current) =>
      current?.type === 'polyline' && current.id === polylineId
        ? null
        : { type: 'polyline', id: polylineId },
    );
  });
  const closeDetailsForDay = useEventCallback((dayId: string) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (!day) {
      return;
    }
    setDetailTarget((current) => {
      if (!current) {
        return null;
      }
      const belongsToDay =
        current.type === 'place'
          ? day.places.some((place) => place.id === current.id)
          : day.polylines.some((polyline) => polyline.id === current.id);
      return belongsToDay ? null : current;
    });
  });
  useEffect(() => {
    if (!detailOpen) {
      return;
    }
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      if (
        event.target.closest('[data-layer-detail-card]') ||
        event.target.closest('[data-layer-detail-toggle]') ||
        event.target.closest('.trip-layer-item') ||
        event.target.closest('[data-layer-interactive-popover]')
      ) {
        return;
      }
      closeDetails();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
  }, [closeDetails, detailOpen]);

  return (
    <>
      <LayerPanelShell sidebarRef={sidebarRef} title={trip.title} busy={busy}>
        <LayerPanelHeader
          trip={trip}
          onAddLayer={onAddLayer}
          onShareTrip={openShareModal}
          shareButtonRef={shareButtonRef}
          onRenameTrip={onRenameTrip}
        />
        <LayerVisibilityControl
          dayCount={trip.days.length}
          visibleCount={visibleDayIds.size}
          onToggle={onToggleAllDayVisibility}
        />
        <LayerPanelContent
          onRequestDeleteDay={setDeleteDay}
          days={trip.days}
          visibleDayIds={visibleDayIds}
          detailPlaceId={detailPlaceId}
          detailPolylineId={detailPolylineId}
          onSelectPlace={selectPlaceFromRow}
          onSelectPolyline={selectPolylineFromRow}
          selectedPlaceIds={selectedPlaceIds}
          selectedPolylineIds={selectedPolylineIds}
          onOpenPlaceDetails={openPlaceDetails}
          onOpenPolylineDetails={openPolylineDetails}
          onFocusPlace={onFocusPlace}
          onCollapseDay={closeDetailsForDay}
          onRenamePlace={onRenamePlace}
          onUpdatePlaceStyle={onUpdatePlaceStyle}
          onUpdatePlaceOrderLock={onUpdatePlaceOrderLock}
          {...contentProps}
        />
      </LayerPanelShell>
      {detailPlaceContext && (
        <LayerPlaceDetailCard
          key={detailPlaceContext.place.id}
          day={detailPlaceContext.day}
          place={detailPlaceContext.place}
          busy={busy}
          mutationError={mutationError}
          anchorKey={`place:${detailPlaceContext.place.id}`}
          sidebarRef={sidebarRef}
          onClose={closeDetails}
          onUpdateVisitTimeRange={onUpdatePlaceVisitTimeRange}
          onUpdatePreferredDuration={onUpdatePlacePreferredDuration}
          onUpdateMemo={onUpdatePlaceMemo}
          onRename={onRenamePlace}
          onUpdateStyle={onUpdatePlaceStyle}
          onRemove={onRemovePlace}
        />
      )}
      {detailPolylineContext && (
        <RouteSettingsCard
          key={detailPolylineContext.polyline.id}
          polyline={detailPolylineContext.polyline}
          fromPlace={detailPolylineContext.fromPlace}
          toPlace={detailPolylineContext.toPlace}
          anchorKey={`polyline:${detailPolylineContext.polyline.id}`}
          busy={busy}
          sidebarRef={sidebarRef}
          onQueryRouteDetails={onQueryRouteDetails}
          onClose={closeDetails}
          onUpdateMode={onUpdatePolylineMode}
        />
      )}
      {deleteDay && (
        <DayDeleteDialog
          day={deleteDay}
          onRemove={onRemoveDay}
          onClose={() => setDeleteDay(null)}
          onRemoved={() => {
            setDeleteDay(null);
            sidebarRef.current
              ?.querySelector<HTMLButtonElement>('button')
              ?.focus();
          }}
        />
      )}
      {shareModalOpen && (
        <ShareTripModal tripId={tripId} onClose={closeShareModal} />
      )}
    </>
  );
});
