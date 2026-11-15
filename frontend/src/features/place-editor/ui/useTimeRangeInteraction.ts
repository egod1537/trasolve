import { useRef } from 'react';
import { useL } from '@/shared/i18n';
import type { Props } from './timeRangeTypes';
import { getEditableRange } from '../model/timeRange';
import { prepareRanges, positionEventLabels } from './timeRangeGeometry';
import { useTimelineRangeEdit } from './useTimelineRangeEdit';
import { useTimelineRangeCreation } from './useTimelineRangeCreation';

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
  const editing = useTimelineRangeEdit({
    axisRef,
    editableRange,
    rangeInteractive,
    disabled,
    normalizedStepMinutes,
    normalizedMinimumRangeMinutes,
    onRangeChange,
    onRangeChangeEnd,
  });
  const creation = useTimelineRangeCreation({
    rangeCreatable,
    disabled,
    normalizedStepMinutes,
    onCreateRange,
  });
  return {
    L,
    axisRef,
    ...editing,
    ...creation,
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
  };
}
