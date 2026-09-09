import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { TripDay } from '../domain/trip';

const autoScrollEdge = 48;
const maximumAutoScrollSpeed = 12;

export type PlaceDragState = {
  dayId: string;
  placeId: string;
  pointerId: number;
  startY: number;
  currentY: number;
  sourceIndex: number;
  targetIndex: number;
};

type Options = {
  days: TripDay[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onMovePlace: (dayId: string, placeId: string, targetIndex: number) => void;
};

function getTargetIndex(
  container: HTMLElement | null,
  dayId: string,
  placeId: string,
  pointerY: number,
): number | null {
  if (!container) return null;

  const rows = Array.from(
    container.querySelectorAll<HTMLElement>('.trip-place-item'),
  ).filter(
    (row) => row.dataset.dayId === dayId && row.dataset.placeId !== placeId,
  );
  if (!rows.length) return 0;

  const beforeIndex = rows.findIndex((row) => {
    const rect = row.getBoundingClientRect();
    return pointerY < rect.top + rect.height / 2;
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

export function usePlaceReorder({ days, scrollRef, onMovePlace }: Options) {
  const [dragState, setDragState] = useState<PlaceDragState | null>(null);
  const dragStateRef = useRef<PlaceDragState | null>(null);
  const pointerYRef = useRef(0);
  const capturedHandleRef = useRef<HTMLButtonElement | null>(null);
  const frameRef = useRef(0);

  const updateDragState = useCallback((next: PlaceDragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  const cancelDrag = useCallback((dayId?: string) => {
    const current = dragStateRef.current;
    if (!current || (dayId && current.dayId !== dayId)) return;

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
      placeId: string,
      sourceIndex: number,
      event: PointerEvent<HTMLButtonElement>,
    ) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      event.currentTarget.setPointerCapture(event.pointerId);
      capturedHandleRef.current = event.currentTarget;
      pointerYRef.current = event.clientY;
      updateDragState({
        dayId,
        placeId,
        pointerId: event.pointerId,
        startY: event.clientY,
        currentY: event.clientY,
        sourceIndex,
        targetIndex: sourceIndex,
      });
    },
    [updateDragState],
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
        current.placeId,
        event.clientY,
      );
      cancelDrag();

      if (
        commit &&
        targetIndex !== null &&
        targetIndex !== current.sourceIndex
      ) {
        onMovePlace(current.dayId, current.placeId, targetIndex);
      }
    },
    [cancelDrag, onMovePlace, scrollRef],
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
      placeId: string,
      sourceIndex: number,
      event: KeyboardEvent<HTMLButtonElement>,
    ) => {
      if (!event.altKey) return;
      const direction =
        event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
      if (!direction) return;

      event.preventDefault();
      event.stopPropagation();
      onMovePlace(dayId, placeId, sourceIndex + direction);
    },
    [onMovePlace],
  );

  const draggedPlaceId = dragState?.placeId;
  useEffect(() => {
    if (!draggedPlaceId) return;

    const updatePreview = () => {
      frameRef.current = 0;
      const current = dragStateRef.current;
      if (!current) return;

      autoScroll(scrollRef.current, pointerYRef.current);
      const targetIndex = getTargetIndex(
        scrollRef.current,
        current.dayId,
        current.placeId,
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
  }, [draggedPlaceId, scrollRef, updateDragState]);

  useEffect(() => {
    const current = dragStateRef.current;
    if (
      current &&
      !days.some(
        (day) =>
          day.id === current.dayId &&
          day.places.some((place) => place.id === current.placeId),
      )
    ) {
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

  return {
    dragState,
    cancelDrag,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onKeyDown,
  };
}
