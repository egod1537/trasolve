import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { TripDay } from '../domain/trip';

const autoScrollEdge = 48;
const maximumAutoScrollSpeed = 12;

export type DayDragState = {
  dayId: string;
  pointerId: number;
  startY: number;
  currentY: number;
  sourceHeight: number;
  sourceIndex: number;
  targetIndex: number;
};

type Options = {
  days: TripDay[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onMoveDay: (dayId: string, targetIndex: number) => void;
  onDragStart?: () => void;
};

function getTargetIndex(
  container: HTMLElement | null,
  dayId: string,
  pointerY: number,
): number | null {
  if (!container) return null;

  const rows = Array.from(
    container.querySelectorAll<HTMLElement>('.trip-day'),
  ).filter((row) => row.dataset.dayId !== dayId);
  if (!rows.length) return 0;

  const beforeIndex = rows.findIndex((row) => {
    const rect = row.getBoundingClientRect();
    const transform = getComputedStyle(row).transform;
    const previewOffset =
      transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
    return pointerY < rect.top - previewOffset + rect.height / 2;
  });
  return beforeIndex < 0 ? rows.length : beforeIndex;
}

function autoScroll(container: HTMLElement | null, pointerY: number): void {
  if (!container) return;

  const rect = container.getBoundingClientRect();
  let direction = 0;
  let intensity = 0;

  if (pointerY < rect.top + autoScrollEdge) {
    direction = -1;
    intensity = Math.min(
      1,
      (rect.top + autoScrollEdge - pointerY) / autoScrollEdge,
    );
  } else if (pointerY > rect.bottom - autoScrollEdge) {
    direction = 1;
    intensity = Math.min(
      1,
      (pointerY - (rect.bottom - autoScrollEdge)) / autoScrollEdge,
    );
  }

  if (!direction) return;
  container.scrollTop +=
    direction * Math.max(2, maximumAutoScrollSpeed * intensity);
}

export function useDayReorder({
  days,
  scrollRef,
  onMoveDay,
  onDragStart,
}: Options) {
  const [dragState, setDragState] = useState<DayDragState | null>(null);
  const dragStateRef = useRef<DayDragState | null>(null);
  const pointerYRef = useRef(0);
  const capturedHandleRef = useRef<HTMLButtonElement | null>(null);
  const frameRef = useRef(0);

  const updateDragState = useCallback((next: DayDragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  const cancelDrag = useCallback(() => {
    const current = dragStateRef.current;
    if (!current) return;

    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    dragStateRef.current = null;
    setDragState(null);

    const handle = capturedHandleRef.current;
    capturedHandleRef.current = null;
    if (handle?.hasPointerCapture(current.pointerId)) {
      handle.releasePointerCapture(current.pointerId);
    }
  }, []);

  const onPointerDown = useCallback(
    (
      dayId: string,
      sourceIndex: number,
      event: PointerEvent<HTMLButtonElement>,
    ) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      onDragStart?.();

      event.currentTarget.setPointerCapture(event.pointerId);
      capturedHandleRef.current = event.currentTarget;
      pointerYRef.current = event.clientY;
      updateDragState({
        dayId,
        pointerId: event.pointerId,
        startY: event.clientY,
        currentY: event.clientY,
        sourceHeight:
          event.currentTarget
            .closest<HTMLElement>('.trip-day')
            ?.getBoundingClientRect().height ?? 0,
        sourceIndex,
        targetIndex: sourceIndex,
      });
    },
    [onDragStart, updateDragState],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const current = dragStateRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      pointerYRef.current = event.clientY;
    },
    [],
  );

  const finishPointerDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
      const current = dragStateRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();

      const targetIndex = getTargetIndex(
        scrollRef.current,
        current.dayId,
        event.clientY,
      );
      cancelDrag();

      if (
        commit &&
        targetIndex !== null &&
        targetIndex !== current.sourceIndex
      ) {
        onMoveDay(current.dayId, targetIndex);
      }
    },
    [cancelDrag, onMoveDay, scrollRef],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      finishPointerDrag(event, true);
    },
    [finishPointerDrag],
  );

  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      finishPointerDrag(event, false);
    },
    [finishPointerDrag],
  );

  const onLostPointerCapture = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const current = dragStateRef.current;
      if (current?.pointerId === event.pointerId) cancelDrag();
    },
    [cancelDrag],
  );

  const onKeyDown = useCallback(
    (
      dayId: string,
      sourceIndex: number,
      event: KeyboardEvent<HTMLButtonElement>,
    ) => {
      if (!event.altKey) return;
      const direction =
        event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
      if (!direction) return;

      event.preventDefault();
      event.stopPropagation();
      const targetIndex = sourceIndex + direction;
      if (targetIndex < 0 || targetIndex >= days.length) return;
      onMoveDay(dayId, targetIndex);
    },
    [days.length, onMoveDay],
  );

  const draggedDayId = dragState?.dayId;
  useEffect(() => {
    if (!draggedDayId) return;

    const updatePreview = () => {
      frameRef.current = 0;
      const current = dragStateRef.current;
      if (!current) return;

      autoScroll(scrollRef.current, pointerYRef.current);
      const targetIndex = getTargetIndex(
        scrollRef.current,
        current.dayId,
        pointerYRef.current,
      );
      if (
        targetIndex !== null &&
        (targetIndex !== current.targetIndex ||
          pointerYRef.current !== current.currentY)
      ) {
        updateDragState({
          ...current,
          currentY: pointerYRef.current,
          targetIndex,
        });
      }
      frameRef.current = requestAnimationFrame(updatePreview);
    };

    frameRef.current = requestAnimationFrame(updatePreview);
    return () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [draggedDayId, scrollRef, updateDragState]);

  useEffect(() => {
    const current = dragStateRef.current;
    if (current && !days.some((day) => day.id === current.dayId)) {
      cancelDrag();
    }
  }, [cancelDrag, days]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      const current = dragStateRef.current;
      const handle = capturedHandleRef.current;
      dragStateRef.current = null;
      capturedHandleRef.current = null;
      if (current && handle?.hasPointerCapture(current.pointerId)) {
        handle.releasePointerCapture(current.pointerId);
      }
    },
    [],
  );

  return useMemo(
    () => ({
      dragState,
      cancelDrag,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      onKeyDown,
    }),
    [
      cancelDrag,
      dragState,
      onKeyDown,
      onLostPointerCapture,
      onPointerCancel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    ],
  );
}
