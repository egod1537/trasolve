import { type CSSProperties } from 'react';

import type { TimeRangeTimelineRange, RangeEdge } from '../model/timeRange';
export type { TimeRangeTimelineRange, RangeEdge } from '../model/timeRange';

export type Props = {
  ranges: readonly TimeRangeTimelineRange[];
  backgroundRanges?: readonly TimeRangeTimelineRange[];
  backgroundRangeLabel?: string;
  ariaLabel: string;
  rangeLabel?: string;
  tone?: 'primary' | 'opening' | 'warning' | 'muted' | 'travel';
  variant?: 'compact' | 'expanded';
  wrapAroundMidnight?: boolean;
  editable?: boolean;
  disabled?: boolean;
  stepMinutes?: number;
  minimumRangeMinutes?: number;
  onRangeChange?: (range: TimeRangeTimelineRange) => void;
  onRangeChangeEnd?: (range: TimeRangeTimelineRange) => void;
  onCreateRange?: (startMinute: number) => void;
};

export type PositionedStyle = CSSProperties & {
  '--timeline-position': string;
};

export type RangeStyle = CSSProperties & {
  '--timeline-start': string;
  '--timeline-size': string;
};

export type PositionedRange = {
  key: string;
  startPosition: number;
  endPosition: number;
};

export type TimelineEvent = {
  key: string;
  position: number;
  text: string;
  edge: 'start' | 'end';
  labelDirection?: 'left' | 'right';
};

export type PreparedRange = {
  segments: PositionedRange[];
  events: TimelineEvent[];
  labelPosition: number;
};

export type DayTick = {
  minute: number;
  label: string;
  edge?: 'start' | 'end';
};

export type RangeEdit = {
  edge: RangeEdge;
  initialRange: TimeRangeTimelineRange;
  lastRange: TimeRangeTimelineRange;
};

export type PointerRangeEdit = RangeEdit & {
  pointerId: number;
};
