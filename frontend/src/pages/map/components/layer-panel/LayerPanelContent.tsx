import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useDayReorder, type DayDragState } from '../../hooks/useDayReorder';
import {
  usePlaceReorder,
  type PlaceDragState,
} from '../../hooks/usePlaceReorder';
import type { LayerValidationByItemKey, TripDay } from '../../domain/trip';
import { DayLayerSection, type SelectionProps } from './DayLayerSection';

type Props = Omit<
  SelectionProps,
  'onSelectPlaceForDetails' | 'onSelectPolylineForDetails'
> & {
  days: TripDay[];
  onMoveDay: (dayId: string, targetIndex: number) => void;
  onRenameDay: (dayId: string, title: string) => void;
  onUpdateDayColor: (dayId: string, color: string) => void;
  onMovePlace: (
    placeId: string,
    targetDayId: string,
    targetIndex: number,
  ) => void;
  onRenamePlace: (placeId: string, name: string) => void;
  detailPlaceId: string | null;
  detailPolylineId: string | null;
  onOpenPlaceDetails: (placeId: string) => void;
  onOpenPolylineDetails: (polylineId: string) => void;
  onCollapseDay: (dayId: string) => void;
  validationByItemKey?: LayerValidationByItemKey;
  selectionRevision: number;
};

type DayDropIndicator = {
  dayId: string;
  position: 'before' | 'after';
} | null;

function getDayDropIndicator(
  days: TripDay[],
  dragState: DayDragState | null,
): DayDropIndicator {
  if (!dragState || dragState.targetIndex === dragState.sourceIndex) {
    return null;
  }

  const stationaryDays = days.filter((day) => day.id !== dragState.dayId);
  const nextDay = stationaryDays[dragState.targetIndex];
  if (nextDay) {
    return { dayId: nextDay.id, position: 'before' };
  }

  const lastDay = stationaryDays.at(-1);
  return lastDay ? { dayId: lastDay.id, position: 'after' } : null;
}

function getLayerItemDayPreviewOffset(
  days: TripDay[],
  dragState: PlaceDragState | null,
  dayIndex: number,
): number {
  if (!dragState || dragState.sourceDayId === dragState.targetDayId) {
    return 0;
  }

  const sourceDayIndex = days.findIndex(
    (day) => day.id === dragState.sourceDayId,
  );
  const targetDayIndex = days.findIndex(
    (day) => day.id === dragState.targetDayId,
  );
  if (sourceDayIndex < 0 || targetDayIndex < 0) {
    return 0;
  }

  if (
    sourceDayIndex < targetDayIndex &&
    dayIndex > sourceDayIndex &&
    dayIndex <= targetDayIndex
  ) {
    return -dragState.sourceHeight;
  }
  if (
    sourceDayIndex > targetDayIndex &&
    dayIndex > targetDayIndex &&
    dayIndex <= sourceDayIndex
  ) {
    return dragState.sourceHeight;
  }
  return 0;
}

export const LayerPanelContent = memo(function LayerPanelContent({
  days,
  onMoveDay,
  onRenameDay,
  onUpdateDayColor,
  onMovePlace,
  onRenamePlace,
  detailPlaceId,
  detailPolylineId,
  onOpenPlaceDetails,
  onOpenPolylineDetails,
  onCollapseDay,
  validationByItemKey,
  selectionRevision,
  ...selection
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    selectedDayId,
    selectedPlaceId,
    selectedPlaceIds,
    selectedPolylineId,
    selectedPolylineIds,
    visibleDayIds,
    onSelectPlace,
    onSelectPlaceForDrag,
    onSelectPolyline,
    onSelectDay,
    onToggleDayVisibility,
  } = selection;
  const reorder = usePlaceReorder({
    days,
    scrollRef,
    onMovePlace,
  });
  const cancelLayerItemDrag = reorder.cancelDrag;
  const dayReorder = useDayReorder({
    days,
    scrollRef,
    onMoveDay,
    onDragStart: cancelLayerItemDrag,
  });
  const cancelDayDrag = dayReorder.cancelDrag;
  const dayDropIndicator = getDayDropIndicator(days, dayReorder.dragState);
  const collapsedRef = useRef(collapsed);
  useLayoutEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  const beforeLayerItemDrag = useCallback(
    (placeId: string) => {
      cancelDayDrag();
      onSelectPlaceForDrag(placeId);
    },
    [cancelDayDrag, onSelectPlaceForDrag],
  );
  const startPlaceNameEditing = useCallback(
    (placeId: string) => {
      cancelLayerItemDrag();
      cancelDayDrag();
      setEditingPlaceId(placeId);
    },
    [cancelDayDrag, cancelLayerItemDrag],
  );
  const finishPlaceNameEditing = useCallback((placeId: string) => {
    setEditingPlaceId((current) => (current === placeId ? null : current));
  }, []);
  const toggleDay = useCallback(
    (dayId: string) => {
      if (!collapsedRef.current.has(dayId)) {
        cancelLayerItemDrag(dayId);
        onCollapseDay(dayId);
      }
      setCollapsed((previous) => {
        const next = new Set(previous);
        if (next.has(dayId)) {
          next.delete(dayId);
        } else {
          next.add(dayId);
        }
        return next;
      });
    },
    [cancelLayerItemDrag, onCollapseDay],
  );

  useEffect(() => {
    if (
      !selectedDayId ||
      (!selectedPlaceId && !selectedPolylineId) ||
      !collapsedRef.current.has(selectedDayId)
    ) {
      return;
    }
    const expandFrame = requestAnimationFrame(() => {
      setCollapsed((previous) => {
        if (!previous.has(selectedDayId)) {
          return previous;
        }
        const next = new Set(previous);
        next.delete(selectedDayId);
        return next;
      });
    });
    return () => cancelAnimationFrame(expandFrame);
  }, [selectedDayId, selectedPlaceId, selectedPolylineId, selectionRevision]);

  useEffect(() => {
    if (!selectedPlaceId && !selectedPolylineId) {
      return;
    }
    const panel = scrollRef.current;
    const item = Array.from(
      panel?.querySelectorAll<HTMLElement>(
        '[data-place-id], [data-polyline-id]',
      ) ?? [],
    ).find(
      (element) =>
        element.dataset.placeId === selectedPlaceId ||
        element.dataset.polylineId === selectedPolylineId,
    );
    if (!panel || !item) {
      return;
    }
    const outer = panel.getBoundingClientRect(),
      inner = item.getBoundingClientRect();
    if (inner.top < outer.top) {
      panel.scrollTop += inner.top - outer.top;
    } else if (inner.bottom > outer.bottom) {
      panel.scrollTop += inner.bottom - outer.bottom;
    }
  }, [selectedPlaceId, selectedPolylineId, collapsed, selectionRevision]);

  return (
    <div className="layer-panel-scroll trip-sidebar-scroll" ref={scrollRef}>
      {days.map((day, index) => (
        <DayLayerSection
          key={day.id}
          day={day}
          dayIndex={index}
          layerItemDayPreviewOffset={getLayerItemDayPreviewOffset(
            days,
            reorder.dragState,
            index,
          )}
          expanded={!collapsed.has(day.id)}
          active={
            selectedDayId === day.id && !selectedPlaceId && !selectedPolylineId
          }
          visible={visibleDayIds.has(day.id)}
          selectedPlaceIds={selectedPlaceIds}
          selectedPolylineIds={selectedPolylineIds}
          reorder={reorder}
          dayReorder={dayReorder}
          dayDropIndicator={
            dayDropIndicator?.dayId === day.id
              ? dayDropIndicator.position
              : null
          }
          onBeforeLayerItemDrag={beforeLayerItemDrag}
          editingPlaceId={
            day.places.some((place) => place.id === editingPlaceId)
              ? editingPlaceId
              : null
          }
          detailPlaceId={
            day.places.some((place) => place.id === detailPlaceId)
              ? detailPlaceId
              : null
          }
          detailPolylineId={
            day.polylines.some((polyline) => polyline.id === detailPolylineId)
              ? detailPolylineId
              : null
          }
          onRenameDay={onRenameDay}
          onUpdateDayColor={onUpdateDayColor}
          onRenamePlace={onRenamePlace}
          onStartPlaceNameEditing={startPlaceNameEditing}
          onFinishPlaceNameEditing={finishPlaceNameEditing}
          onOpenPlaceDetails={onOpenPlaceDetails}
          onOpenPolylineDetails={onOpenPolylineDetails}
          validationByItemKey={validationByItemKey}
          onToggle={toggleDay}
          onSelectPlace={onSelectPlace}
          onSelectPolyline={onSelectPolyline}
          onSelectDay={onSelectDay}
          onToggleDayVisibility={onToggleDayVisibility}
        />
      ))}
      {!days.length && (
        <p className="trip-empty-day">아직 여행 일정이 없습니다.</p>
      )}
    </div>
  );
});
