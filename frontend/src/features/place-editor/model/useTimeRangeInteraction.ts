import {
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

import { useL } from '@/shared/i18n';
import {
  type TimeRangeTimelineRange,
  type Props,
  type RangeEdge,
  type RangeEdit,
  type PointerRangeEdit,
} from '@/features/place-editor/ui/timeRangeTypes';
import {
  MINUTES_PER_DAY,
  clamp,
  snapTimelineMinute,
  getMinuteFromPointerPosition,
  updateEditableRange,
  isSameRange,
  getEditableRange,
  prepareRanges,
  positionEventLabels,
} from '@/features/place-editor/ui/timeRangeGeometry';

export function useTimeRangeInteraction({
  ranges,
  backgroundRanges = [],
  wrapAroundMidnight = false,
  editable = false,
  disabled = false,
  stepMinutes = 15,
  minimumRangeMinutes = stepMinutes,
  onRangeChange,
  onRangeChangeEnd,
  onCreateRange,
}: Props) {
  const L = useL();
  const axisRef = useRef<HTMLSpanElement>(null);
  const pointerEditRef = useRef<PointerRangeEdit | null>(null);
  const keyboardEditRef = useRef<RangeEdit | null>(null);
  const [activeEdge, setActiveEdge] = useState<RangeEdge | null>(null);
  const [creationMinute, setCreationMinute] = useState(MINUTES_PER_DAY / 2);
  const [creationFocused, setCreationFocused] = useState(false);
  const normalizedStepMinutes = Math.max(1, Math.round(stepMinutes));
  const normalizedMinimumRangeMinutes = Math.max(
    normalizedStepMinutes,
    Math.round(minimumRangeMinutes),
  );
  const editableRange = editable
    ? getEditableRange(ranges, normalizedMinimumRangeMinutes)
    : null;
  const rangeInteractive =
    editableRange !== null &&
    onRangeChange !== undefined &&
    onRangeChangeEnd !== undefined;
  const rangeCreatable = editable && ranges.length === 0 && !!onCreateRange;
  const interactive = rangeInteractive || rangeCreatable;
  const preparedRanges = prepareRanges(ranges, wrapAroundMidnight);
  const positionedRanges = preparedRanges.flatMap((range) => range.segments);
  const events = positionEventLabels(
    preparedRanges.flatMap((range) => range.events),
    true,
  );
  const preparedBackgroundRanges = prepareRanges(
    backgroundRanges,
    wrapAroundMidnight,
  );
  const positionedBackgroundRanges = preparedBackgroundRanges.flatMap(
    (range) => range.segments,
  );
  const backgroundEvents = positionEventLabels(
    preparedBackgroundRanges.flatMap((range) => range.events),
  );
  const backgroundLabelPosition = preparedBackgroundRanges[0]?.labelPosition;
  const hasBackgroundRanges = positionedBackgroundRanges.length > 0;
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
  const createRangeFromClick = (event: MouseEvent<HTMLSpanElement>) => {
    if (!rangeCreatable || disabled || event.detail === 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const minute = getMinuteFromPointerPosition(
      event.clientX,
      event.currentTarget.getBoundingClientRect(),
      normalizedStepMinutes,
    );
    setCreationMinute(minute);
    onCreateRange?.(minute);
  };
  const moveCreationMinute = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!rangeCreatable || disabled) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onCreateRange?.(creationMinute);
      return;
    }
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setCreationMinute((current) => {
      if (event.key === 'Home') {
        return 0;
      }
      if (event.key === 'End') {
        return MINUTES_PER_DAY;
      }
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      return clamp(
        snapTimelineMinute(current, normalizedStepMinutes) +
          direction * normalizedStepMinutes,
        0,
        MINUTES_PER_DAY,
      );
    });
  };
  return {
    L,
    axisRef,
    activeEdge,
    creationMinute,
    creationFocused,
    setCreationFocused,
    normalizedMinimumRangeMinutes,
    editableRange,
    rangeInteractive,
    rangeCreatable,
    interactive,
    positionedRanges,
    events,
    positionedBackgroundRanges,
    backgroundEvents,
    backgroundLabelPosition,
    hasBackgroundRanges,
    startPointerEdit,
    movePointerEdit,
    finishPointerEdit,
    cancelPointerEdit,
    moveKeyboardEdit,
    finishKeyboardEdit,
    createRangeFromClick,
    moveCreationMinute,
  };
}
