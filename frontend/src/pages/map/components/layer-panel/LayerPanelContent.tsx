import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
  const [expandedDayIds, setExpandedDayIds] = useState<Set<string>>(
    () =>
      new Set(
        selectedDayId && visibleDayIds.has(selectedDayId)
          ? [selectedDayId]
          : [],
      ),
  );
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const daysRef = useRef(days);
  const visibleDayIdsRef = useRef(visibleDayIds);
  const expandedDayIdsRef = useRef(expandedDayIds);
  const previousActiveDayIdRef = useRef(selectedDayId);

  useEffect(() => {
    daysRef.current = days;
    visibleDayIdsRef.current = visibleDayIds;
  }, [days, visibleDayIds]);

  const expandDay = useCallback((dayId: string) => {
    const current = expandedDayIdsRef.current;
    if (current.has(dayId)) {
      return;
    }
    const next = new Set(current);
    next.add(dayId);
    expandedDayIdsRef.current = next;
    setExpandedDayIds(next);
  }, []);
  const collapseDay = useCallback(
    (dayId: string) => {
      const current = expandedDayIdsRef.current;
      if (!current.has(dayId)) {
        return false;
      }
      const next = new Set(current);
      next.delete(dayId);
      expandedDayIdsRef.current = next;
      setExpandedDayIds(next);
      onCollapseDay(dayId);
      return true;
    },
    [onCollapseDay],
  );
  const transitionActiveDay = useCallback(
    (nextActiveDayId: string | null) => {
      const previousActiveDayId = previousActiveDayIdRef.current;
      if (previousActiveDayId === nextActiveDayId) {
        return;
      }

      previousActiveDayIdRef.current = nextActiveDayId;
      if (previousActiveDayId) {
        collapseDay(previousActiveDayId);
      }
      if (nextActiveDayId && visibleDayIds.has(nextActiveDayId)) {
        expandDay(nextActiveDayId);
      }
    },
    [collapseDay, expandDay, visibleDayIds],
  );

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
  const activateDay = useCallback(
    (dayId: string) => {
      if (!visibleDayIds.has(dayId)) {
        return;
      }
      cancelLayerItemDrag();
      cancelDayDrag();
      if (previousActiveDayIdRef.current === dayId) {
        expandDay(dayId);
      } else {
        transitionActiveDay(dayId);
      }
      onSelectDay(dayId);
    },
    [
      cancelDayDrag,
      cancelLayerItemDrag,
      expandDay,
      onSelectDay,
      transitionActiveDay,
      visibleDayIds,
    ],
  );
  const toggleDayExpanded = useCallback(
    (dayId: string) => {
      if (!visibleDayIds.has(dayId)) {
        return;
      }
      cancelLayerItemDrag();
      cancelDayDrag();
      if (!collapseDay(dayId)) {
        expandDay(dayId);
      }
    },
    [cancelDayDrag, cancelLayerItemDrag, collapseDay, expandDay, visibleDayIds],
  );
  const toggleDayVisibility = useCallback(
    (dayId: string) => {
      const hiding = visibleDayIds.has(dayId);
      if (hiding && !collapseDay(dayId)) {
        onCollapseDay(dayId);
      }
      onToggleDayVisibility(dayId);
    },
    [collapseDay, onCollapseDay, onToggleDayVisibility, visibleDayIds],
  );

  useEffect(() => {
    transitionActiveDay(selectedDayId);
  }, [selectedDayId, transitionActiveDay]);

  useEffect(() => {
    const selectedItemDayId = daysRef.current.find((day) =>
      selectedPlaceId
        ? day.places.some((place) => place.id === selectedPlaceId)
        : selectedPolylineId
          ? day.polylines.some((polyline) => polyline.id === selectedPolylineId)
          : false,
    )?.id;
    if (
      !selectedItemDayId ||
      !visibleDayIdsRef.current.has(selectedItemDayId)
    ) {
      return;
    }
    expandDay(selectedItemDayId);
  }, [expandDay, selectedPlaceId, selectedPolylineId]);

  useEffect(() => {
    const validDayIds = new Set(days.map((day) => day.id));
    const current = expandedDayIdsRef.current;
    if ([...current].every((dayId) => validDayIds.has(dayId))) {
      return;
    }

    const next = new Set(
      [...current].filter((dayId) => validDayIds.has(dayId)),
    );
    expandedDayIdsRef.current = next;
    setExpandedDayIds(next);
  }, [days]);

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
  }, [
    expandedDayIds,
    selectedDayId,
    selectedPlaceId,
    selectedPolylineId,
    selectionRevision,
  ]);

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
          expanded={expandedDayIds.has(day.id)}
          active={selectedDayId === day.id}
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
          onSelectPlace={onSelectPlace}
          onSelectPolyline={onSelectPolyline}
          onActivateDay={activateDay}
          onToggleExpanded={toggleDayExpanded}
          onToggleDayVisibility={toggleDayVisibility}
        />
      ))}
      {!days.length && (
        <p className="trip-empty-day">아직 여행 일정이 없습니다.</p>
      )}
    </div>
  );
});
