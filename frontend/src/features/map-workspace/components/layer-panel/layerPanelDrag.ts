import { type DayDragState } from '@/features/map-workspace/hooks/useDayReorder';
import { type PlaceDragState } from '@/features/map-workspace/hooks/usePlaceReorder';
import type { TripDay } from '@/entities/trip';

export type DayDropIndicator = {
  dayId: string;
  position: 'before' | 'after';
} | null;

export const PLACE_DRAG_EXPAND_DELAY_MS = 500;

export function getCollapsedDayHeaderHover(
  container: HTMLElement | null,
  dragState: PlaceDragState | null,
  expandedDayIds: ReadonlySet<string>,
): string | null {
  if (
    !container ||
    !dragState ||
    dragState.sourceDayId === dragState.targetDayId ||
    expandedDayIds.has(dragState.targetDayId)
  ) {
    return null;
  }

  const targetDay = Array.from(
    container.querySelectorAll<HTMLElement>('.trip-day'),
  ).find((section) => section.dataset.dayId === dragState.targetDayId);
  const heading = targetDay?.querySelector<HTMLElement>('.trip-day-heading');
  if (!heading) {
    return null;
  }

  const rect = heading.getBoundingClientRect();
  return dragState.currentX >= rect.left &&
    dragState.currentX <= rect.right &&
    dragState.currentY >= rect.top &&
    dragState.currentY <= rect.bottom
    ? dragState.targetDayId
    : null;
}

export function getDayDropIndicator(
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

export function getLayerItemDayPreviewOffset(
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
