import { useEffect, useRef, useState } from 'react';
import { usePlaceReorder } from '../../hooks/usePlaceReorder';
import type { TripDay } from '../../domain/trip';
import { DayLayerSection, type SelectionProps } from './DayLayerSection';

type Props = SelectionProps & {
  days: TripDay[];
  onMovePlace: (dayId: string, placeId: string, targetIndex: number) => void;
  selectionRevision: number;
};

export function LayerPanelContent({
  days,
  onMovePlace,
  selectionRevision,
  ...selection
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const { selectedDayId, selectedPlaceId } = selection;
  const reorder = usePlaceReorder({
    days,
    scrollRef,
    onMovePlace,
  });

  useEffect(() => {
    if (!selectedDayId || !selectedPlaceId) return;
    const expandFrame = requestAnimationFrame(() => {
      setCollapsed((previous) => {
        if (!previous.has(selectedDayId)) return previous;
        const next = new Set(previous);
        next.delete(selectedDayId);
        return next;
      });
    });
    return () => cancelAnimationFrame(expandFrame);
  }, [selectedDayId, selectedPlaceId, selectionRevision]);

  useEffect(() => {
    if (!selectedPlaceId) return;
    const panel = scrollRef.current;
    const item = Array.from(
      panel?.querySelectorAll<HTMLElement>('[data-place-id]') ?? [],
    ).find((element) => element.dataset.placeId === selectedPlaceId);
    if (!panel || !item) return;
    const outer = panel.getBoundingClientRect(),
      inner = item.getBoundingClientRect();
    if (inner.top < outer.top) panel.scrollTop += inner.top - outer.top;
    else if (inner.bottom > outer.bottom)
      panel.scrollTop += inner.bottom - outer.bottom;
  }, [selectedPlaceId, collapsed, selectionRevision]);

  return (
    <div className="layer-panel-scroll trip-sidebar-scroll" ref={scrollRef}>
      {days.map((day) => (
        <DayLayerSection
          key={day.id}
          day={day}
          expanded={!collapsed.has(day.id)}
          reorder={reorder}
          onToggle={() => {
            if (!collapsed.has(day.id)) reorder.cancelDrag(day.id);
            setCollapsed((previous) => {
              const next = new Set(previous);
              if (next.has(day.id)) next.delete(day.id);
              else next.add(day.id);
              return next;
            });
          }}
          {...selection}
        />
      ))}
      {!days.length && (
        <p className="trip-empty-day">아직 여행 일정이 없습니다.</p>
      )}
    </div>
  );
}
