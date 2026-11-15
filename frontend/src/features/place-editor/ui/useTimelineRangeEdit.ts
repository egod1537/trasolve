import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import type {
  TimeRangeTimelineRange,
  RangeEdge,
  RangeEdit,
  PointerRangeEdit,
} from './timeRangeTypes';
import {
  snapTimelineMinute,
  updateEditableRange,
  isSameRange,
} from '../model/timeRange';
import { getMinuteFromPointerPosition } from './timeRangeGeometry';

type Options = {
  axisRef: RefObject<HTMLSpanElement | null>;
  editableRange: TimeRangeTimelineRange | null;
  rangeInteractive: boolean;
  disabled: boolean;
  normalizedStepMinutes: number;
  normalizedMinimumRangeMinutes: number;
  onRangeChange?: (range: TimeRangeTimelineRange) => void;
  onRangeChangeEnd?: (range: TimeRangeTimelineRange) => void;
};
export function useTimelineRangeEdit({
  axisRef,
  editableRange,
  rangeInteractive,
  disabled,
  normalizedStepMinutes,
  normalizedMinimumRangeMinutes,
  onRangeChange,
  onRangeChangeEnd,
}: Options) {
  const pointerEditRef = useRef<PointerRangeEdit | null>(null);
  const keyboardEditRef = useRef<RangeEdit | null>(null);
  const [activeEdge, setActiveEdge] = useState<RangeEdge | null>(null);
  const getPointerRange = (
    edit: PointerRangeEdit,
    clientX: number,
  ): TimeRangeTimelineRange => {
    const axisRect = axisRef.current?.getBoundingClientRect();
    if (!axisRect) {
      return edit.lastRange;
    }
    return updateEditableRange(
      edit.initialRange,
      edit.edge,
      getMinuteFromPointerPosition(clientX, axisRect, normalizedStepMinutes),
      normalizedStepMinutes,
      normalizedMinimumRangeMinutes,
    );
  };
  const startPointerEdit = (
    event: PointerEvent<HTMLButtonElement>,
    edge: RangeEdge,
  ) => {
    if (
      !rangeInteractive ||
      !editableRange ||
      disabled ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerEditRef.current = {
      edge,
      pointerId: event.pointerId,
      initialRange: editableRange,
      lastRange: editableRange,
    };
    keyboardEditRef.current = null;
    setActiveEdge(edge);
  };
  const movePointerEdit = (event: PointerEvent<HTMLButtonElement>) => {
    const edit = pointerEditRef.current;
    if (!edit || edit.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const nextRange = getPointerRange(edit, event.clientX);
    if (isSameRange(nextRange, edit.lastRange)) {
      return;
    }
    edit.lastRange = nextRange;
    onRangeChange?.(nextRange);
  };
  const finishPointerEdit = (event: PointerEvent<HTMLButtonElement>) => {
    const edit = pointerEditRef.current;
    if (!edit || edit.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const nextRange = getPointerRange(edit, event.clientX);
    if (!isSameRange(nextRange, edit.lastRange)) {
      onRangeChange?.(nextRange);
    }
    pointerEditRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setActiveEdge(null);
    if (!isSameRange(nextRange, edit.initialRange)) {
      onRangeChangeEnd?.(nextRange);
    }
  };
  const cancelPointerEdit = (event: PointerEvent<HTMLButtonElement>) => {
    const edit = pointerEditRef.current;
    if (!edit || edit.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!isSameRange(edit.lastRange, edit.initialRange)) {
      onRangeChange?.(edit.initialRange);
    }
    pointerEditRef.current = null;
    setActiveEdge(null);
  };
  const moveKeyboardEdit = (
    event: KeyboardEvent<HTMLButtonElement>,
    edge: RangeEdge,
  ) => {
    if (
      !rangeInteractive ||
      !editableRange ||
      disabled ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const currentEdit = keyboardEditRef.current;
    const edit =
      currentEdit?.edge === edge
        ? currentEdit
        : {
            edge,
            initialRange: editableRange,
            lastRange: editableRange,
          };
    const currentMinute =
      edge === 'start' ? edit.lastRange.start : edit.lastRange.end;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const nextRange = updateEditableRange(
      edit.lastRange,
      edge,
      snapTimelineMinute(currentMinute, normalizedStepMinutes) +
        direction * normalizedStepMinutes,
      normalizedStepMinutes,
      normalizedMinimumRangeMinutes,
    );
    keyboardEditRef.current = edit;
    setActiveEdge(edge);
    if (isSameRange(nextRange, edit.lastRange)) {
      return;
    }
    edit.lastRange = nextRange;
    onRangeChange?.(nextRange);
  };
  const finishKeyboardEdit = (edge: RangeEdge, key?: string) => {
    if (key && key !== 'ArrowLeft' && key !== 'ArrowRight') {
      return;
    }
    const edit = keyboardEditRef.current;
    if (!edit || edit.edge !== edge) {
      return;
    }
    keyboardEditRef.current = null;
    setActiveEdge(null);
    if (!isSameRange(edit.lastRange, edit.initialRange)) {
      onRangeChangeEnd?.(edit.lastRange);
    }
  };
  return {
    activeEdge,
    startPointerEdit,
    movePointerEdit,
    finishPointerEdit,
    cancelPointerEdit,
    moveKeyboardEdit,
    finishKeyboardEdit,
  };
}
