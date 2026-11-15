import { useState, type MouseEvent, type KeyboardEvent } from 'react';
import { MINUTES_PER_DAY, clamp, snapTimelineMinute } from '../model/timeRange';
import { getMinuteFromPointerPosition } from './timeRangeGeometry';

type Options = {
  rangeCreatable: boolean;
  disabled: boolean;
  normalizedStepMinutes: number;
  onCreateRange?: (minute: number) => void;
};
export function useTimelineRangeCreation({
  rangeCreatable,
  disabled,
  normalizedStepMinutes,
  onCreateRange,
}: Options) {
  const [creationMinute, setCreationMinute] = useState(MINUTES_PER_DAY / 2);
  const [creationFocused, setCreationFocused] = useState(false);
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
    creationMinute,
    creationFocused,
    setCreationFocused,
    createRangeFromClick,
    moveCreationMinute,
  };
}
