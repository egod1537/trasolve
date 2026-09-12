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

export type PlaceDragState = {
  sourceDayId: string;
  targetDayId: string;
  placeId: string;
  pointerId: number;
  startY: number;
  currentY: number;
  sourceHeight: number;
  sourceIndex: number;
  targetIndex: number;
};

type PlaceDropTarget = {
  dayId: string;
  index: number;
};

type Options = {
  days: TripDay[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onMovePlace: (
    placeId: string,
    targetDayId: string,
    targetIndex: number,
  ) => void;
};

function getPreviewOffset(element: HTMLElement): number {
  const transform = getComputedStyle(element).transform;
  return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
}

function getTarget(
  container: HTMLElement | null,
  placeId: string,
  pointerY: number,
): PlaceDropTarget | null {
  if (!container) return null;
  const daySections = Array.from(
    container.querySelectorAll<HTMLElement>('.trip-day'),
  );
  if (!daySections.length) return null;
  const targetDay =
    daySections.find((section) => {
      const rect = section.getBoundingClientRect();
      const previewOffset = getPreviewOffset(section);
      return (
        pointerY >= rect.top - previewOffset &&
        pointerY <= rect.bottom - previewOffset
      );
    }) ??
    daySections.reduce((nearest, section) => {
      const rect = section.getBoundingClientRect();
      const nearestRect = nearest.getBoundingClientRect();
      const distance = Math.min(
        Math.abs(pointerY - rect.top),
        Math.abs(pointerY - rect.bottom),
      );
      const nearestDistance = Math.min(
        Math.abs(pointerY - nearestRect.top),
        Math.abs(pointerY - nearestRect.bottom),
      );
      return distance < nearestDistance ? section : nearest;
    });
  const dayId = targetDay.dataset.dayId;
  if (!dayId) return null;
  const rows = Array.from(
    targetDay.querySelectorAll<HTMLElement>('[data-place-id]'),
  ).filter((row) => row.dataset.placeId !== placeId);
  const beforeIndex = rows.findIndex((row) => {
    const rect = row.getBoundingClientRect();
    return pointerY < rect.top + rect.height / 2;
  });
  return { dayId, index: beforeIndex < 0 ? rows.length : beforeIndex };
}

function autoScroll(container: HTMLElement | null, pointerY: number): void {
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const above = rect.top + autoScrollEdge - pointerY;
  const below = pointerY - (rect.bottom - autoScrollEdge);
  if (above > 0) {
    container.scrollTop -= Math.max(
      2,
      maximumAutoScrollSpeed * Math.min(1, above / autoScrollEdge),
    );
  } else if (below > 0) {
    container.scrollTop += Math.max(
      2,
      maximumAutoScrollSpeed * Math.min(1, below / autoScrollEdge),
    );
  }
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
    if (
      !current ||
      (dayId && current.sourceDayId !== dayId && current.targetDayId !== dayId)
    ) {
      return;
    }
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
        sourceDayId: dayId,
        targetDayId: dayId,
        placeId,
        pointerId: event.pointerId,
        startY: event.clientY,
        currentY: event.clientY,
        sourceHeight:
          event.currentTarget
            .closest<HTMLElement>('.trip-layer-item')
            ?.getBoundingClientRect().height ?? 0,
        sourceIndex,
        targetIndex: sourceIndex,
      });
    },
    [updateDragState],
  );
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) return;
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
      const target = getTarget(
        scrollRef.current,
        current.placeId,
        event.clientY,
      );
      cancelDrag();
      if (
        commit &&
        target &&
        (target.dayId !== current.sourceDayId ||
          target.index !== current.sourceIndex)
      ) {
        onMovePlace(current.placeId, target.dayId, target.index);
      }
    },
    [cancelDrag, onMovePlace, scrollRef],
  );
  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => finishPointerDrag(event, true),
    [finishPointerDrag],
  );
  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => finishPointerDrag(event, false),
    [finishPointerDrag],
  );
  const onLostPointerCapture = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (dragStateRef.current?.pointerId === event.pointerId) cancelDrag();
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
      const day = days.find((candidate) => candidate.id === dayId);
      const targetIndex = sourceIndex + direction;
      if (!day || targetIndex < 0 || targetIndex >= day.places.length) return;
      event.preventDefault();
      event.stopPropagation();
      onMovePlace(placeId, dayId, targetIndex);
    },
    [days, onMovePlace],
  );

  useEffect(() => {
    if (!dragState?.placeId) return;
    const updatePreview = () => {
      frameRef.current = 0;
      const current = dragStateRef.current;
      if (!current) return;
      autoScroll(scrollRef.current, pointerYRef.current);
      const target = getTarget(
        scrollRef.current,
        current.placeId,
        pointerYRef.current,
      );
      if (
        target &&
        (target.dayId !== current.targetDayId ||
          target.index !== current.targetIndex ||
          pointerYRef.current !== current.currentY)
      ) {
        updateDragState({
          ...current,
          currentY: pointerYRef.current,
          targetDayId: target.dayId,
          targetIndex: target.index,
        });
      }
      frameRef.current = requestAnimationFrame(updatePreview);
    };
    frameRef.current = requestAnimationFrame(updatePreview);
    return () => cancelAnimationFrame(frameRef.current);
  }, [dragState?.placeId, scrollRef, updateDragState]);

  useEffect(() => {
    const current = dragStateRef.current;
    if (
      current &&
      !days.some(
        (day) =>
          day.id === current.sourceDayId &&
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
