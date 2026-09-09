import { useEffect, useRef, useState, type RefObject } from 'react';
import { usePlaceReorder } from '../../../hooks/usePlaceReorder';
import type { Trip } from '../../../types/trip';
import { DayLayerSection, type SelectionProps } from './DayLayerSection';

export function LayerPanel({
  trip,
  busy,
  sidebarRef,
  onShowAll,
  onMovePlace,
  selectionRevision,
  ...selection
}: SelectionProps & {
  trip: Trip;
  busy: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  onShowAll: () => void;
  onMovePlace: (dayId: string, placeId: string, targetIndex: number) => void;
  selectionRevision: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const { selectedDayId, selectedPlaceId } = selection;
  const reorder = usePlaceReorder({
    days: trip.days,
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
    <aside
      ref={sidebarRef}
      className="layer-panel trip-sidebar"
      inert={busy}
      aria-label="여행 일정"
    >
      <div className="trip-sidebar-header">
        <a className="trip-home" href="/">
          ← Trasolve
        </a>
        <p className="trip-sample-label">여행 일정</p>
        <h1>{trip.title}</h1>
        <p className="trip-period">{trip.period}</p>
        <div className="trip-overview">
          <span>
            {trip.days.length}일 ·{' '}
            {trip.days.reduce((total, day) => total + day.places.length, 0)}개
            장소
          </span>
          <button type="button" onClick={onShowAll}>
            전체 일정 보기
          </button>
        </div>
      </div>
      <div className="layer-panel-scroll trip-sidebar-scroll" ref={scrollRef}>
        {trip.days.map((day) => (
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
        {!trip.days.length && (
          <p className="trip-empty-day">아직 여행 일정이 없습니다.</p>
        )}
      </div>
      <p className="trip-sidebar-note">
        지도 선은 방문 순서를 나타냅니다.
        <br />
        실제 이동 경로와는 다를 수 있습니다.
      </p>
    </aside>
  );
}
