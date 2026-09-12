import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import type { PlaceStyle, TripPolylineMode } from '@trasolve/shared';
import type { LayerValidationByItemKey, Trip } from '../../domain/trip';
import { RouteSettingsCard } from '../RouteSettingsCard';
import type { SelectionProps } from './DayLayerSection';
import { LayerPanelHeader } from './LayerPanelHeader';
import { LayerPanelContent } from './LayerPanelContent';
import { LayerPlaceDetailCard } from './LayerPlaceDetailCard';

type DetailTarget =
  { type: 'place'; id: string } | { type: 'polyline'; id: string } | null;

type Props = SelectionProps & {
  trip: Trip;
  busy: boolean;
  saveStatus: 'ready' | 'saving' | 'error';
  savedAt: string;
  mutationError: string | null;
  sidebarRef: RefObject<HTMLElement | null>;
  onAddLayer: () => void;
  onShareTrip?: () => void;
  onPreviewTrip?: () => void;
  onRenameTrip: (title: string) => void;
  onMoveDay: (dayId: string, targetIndex: number) => void;
  onRenameDay: (dayId: string, title: string) => void;
  onUpdateDayColor: (dayId: string, color: string) => void;
  onMovePlace: (
    placeId: string,
    targetDayId: string,
    targetIndex: number,
  ) => void;
  onRenamePlace: (placeId: string, name: string) => Promise<boolean>;
  onUpdatePolylineMode: (
    polylineId: string,
    mode: TripPolylineMode,
  ) => Promise<boolean>;
  onUpdatePlaceTimeRange: (
    placeId: string,
    time: string,
    durationMinutes: number,
  ) => Promise<boolean>;
  onUpdatePlaceMemo: (placeId: string, memo: string) => Promise<boolean>;
  onRemovePlace: (placeId: string) => Promise<boolean>;
  onUpdatePlaceStyle: (placeId: string, style: PlaceStyle) => void;
  validationByItemKey?: LayerValidationByItemKey;
  selectionRevision: number;
};

export const LayerPanel = memo(function LayerPanel({
  trip,
  busy,
  saveStatus,
  savedAt,
  mutationError,
  sidebarRef,
  onAddLayer,
  onShareTrip,
  onPreviewTrip,
  onRenameTrip,
  onUpdatePlaceTimeRange,
  onUpdatePlaceMemo,
  onRenamePlace,
  onUpdatePlaceStyle,
  onRemovePlace,
  onUpdatePolylineMode,
  onSelectPlace,
  onSelectPlaceForDetails,
  onSelectPolyline,
  onSelectPolylineForDetails,
  selectedPlaceIds,
  selectedPolylineIds,
  ...contentProps
}: Props) {
  const [detailTarget, setDetailTarget] = useState<DetailTarget>(null);
  const detailPlaceId = detailTarget?.type === 'place' ? detailTarget.id : null;
  const detailPolylineId =
    detailTarget?.type === 'polyline' ? detailTarget.id : null;
  const detailPlaceContext = useMemo(
    () =>
      trip.days
        .flatMap((day) =>
          day.places.map((place) => ({
            day,
            place,
          })),
        )
        .find(({ place }) => place.id === detailPlaceId),
    [detailPlaceId, trip.days],
  );
  const detailPolylineContext = useMemo(
    () =>
      trip.days
        .flatMap((day) => day.polylines)
        .find((polyline) => polyline.id === detailPolylineId),
    [detailPolylineId, trip.days],
  );
  const detailOpen = !!detailPlaceContext || !!detailPolylineContext;
  const closeDetails = useCallback(() => setDetailTarget(null), []);
  const selectPlaceFromRow = useCallback<SelectionProps['onSelectPlace']>(
    (placeId, modifiers) => {
      setDetailTarget(null);
      onSelectPlace(placeId, modifiers);
    },
    [onSelectPlace],
  );
  const selectPolylineFromRow = useCallback<SelectionProps['onSelectPolyline']>(
    (polylineId, modifiers) => {
      setDetailTarget(null);
      onSelectPolyline(polylineId, modifiers);
    },
    [onSelectPolyline],
  );
  const openPlaceDetails = useCallback(
    (placeId: string) => {
      onSelectPlaceForDetails(placeId);
      setDetailTarget((current) =>
        current?.type === 'place' && current.id === placeId
          ? null
          : { type: 'place', id: placeId },
      );
    },
    [onSelectPlaceForDetails],
  );
  const openPolylineDetails = useCallback(
    (polylineId: string) => {
      onSelectPolylineForDetails(polylineId);
      setDetailTarget((current) =>
        current?.type === 'polyline' && current.id === polylineId
          ? null
          : { type: 'polyline', id: polylineId },
      );
    },
    [onSelectPolylineForDetails],
  );
  const closeDetailsForDay = useCallback(
    (dayId: string) => {
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
    },
    [trip.days],
  );

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
        event.target.closest('.trip-layer-item')
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
      <aside
        ref={sidebarRef}
        className="layer-panel trip-sidebar"
        inert={busy}
        aria-label="여행 일정"
      >
        <LayerPanelHeader
          trip={trip}
          saveStatus={saveStatus}
          savedAt={savedAt}
          onAddLayer={onAddLayer}
          onShareTrip={onShareTrip}
          onPreviewTrip={onPreviewTrip}
          onRenameTrip={onRenameTrip}
        />
        <LayerPanelContent
          days={trip.days}
          detailPlaceId={detailPlaceId}
          detailPolylineId={detailPolylineId}
          onSelectPlace={selectPlaceFromRow}
          onSelectPolyline={selectPolylineFromRow}
          selectedPlaceIds={selectedPlaceIds}
          selectedPolylineIds={selectedPolylineIds}
          onOpenPlaceDetails={openPlaceDetails}
          onOpenPolylineDetails={openPolylineDetails}
          onCollapseDay={closeDetailsForDay}
          onRenamePlace={onRenamePlace}
          {...contentProps}
        />
      </aside>
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
          onUpdateTimeRange={onUpdatePlaceTimeRange}
          onUpdateMemo={onUpdatePlaceMemo}
          onRename={onRenamePlace}
          onUpdateStyle={onUpdatePlaceStyle}
          onRemove={onRemovePlace}
        />
      )}
      {detailPolylineContext && (
        <RouteSettingsCard
          key={detailPolylineContext.id}
          polyline={detailPolylineContext}
          anchorKey={`polyline:${detailPolylineContext.id}`}
          busy={busy}
          sidebarRef={sidebarRef}
          onClose={closeDetails}
          onUpdateMode={onUpdatePolylineMode}
        />
      )}
    </>
  );
});
