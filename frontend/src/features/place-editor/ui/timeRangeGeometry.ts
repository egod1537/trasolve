import {
  MINUTES_PER_DAY,
  clamp,
  snapTimelineMinute,
  normalizeDayMinute,
} from '../model/timeRange';
import { formatClockTime } from '@/entities/place';
import {
  type TimeRangeTimelineRange,
  type PositionedRange,
  type TimelineEvent,
  type PreparedRange,
  type DayTick,
} from '@/features/place-editor/ui/timeRangeTypes';

export const DAY_TICKS: readonly DayTick[] = [
  { minute: 0, label: '00:00', edge: 'start' },
  { minute: 6 * 60, label: '06:00' },
  { minute: 12 * 60, label: '12:00' },
  { minute: 18 * 60, label: '18:00' },
  { minute: MINUTES_PER_DAY, label: '24:00', edge: 'end' },
] as const;

export function getMinuteFromPointerPosition(
  clientX: number,
  axisRect: DOMRect,
  stepMinutes: number,
): number {
  if (axisRect.width <= 0) {
    return 0;
  }
  const ratio = clamp((clientX - axisRect.left) / axisRect.width, 0, 1);
  return clamp(
    snapTimelineMinute(ratio * MINUTES_PER_DAY, stepMinutes),
    0,
    MINUTES_PER_DAY,
  );
}

export function getDayPosition(minute: number, endOfDay = false): number {
  const normalized = normalizeDayMinute(minute);
  const dayMinute =
    endOfDay && minute > 0 && normalized === 0 ? MINUTES_PER_DAY : normalized;
  return (dayMinute / MINUTES_PER_DAY) * 100;
}

export function getTimelinePositionClass(position: number): string {
  if (position <= 8) {
    return ' is-start-edge';
  }
  if (position >= 92) {
    return ' is-end-edge';
  }
  return '';
}

export function getLabelPosition(segments: readonly PositionedRange[]): number {
  const widestSegment = segments.reduce<PositionedRange | undefined>(
    (widest, segment) =>
      !widest ||
      segment.endPosition - segment.startPosition >
        widest.endPosition - widest.startPosition
        ? segment
        : widest,
    undefined,
  );
  return widestSegment
    ? widestSegment.startPosition +
        (widestSegment.endPosition - widestSegment.startPosition) / 2
    : 0;
}

export function prepareClippedRange(
  range: TimeRangeTimelineRange,
  index: number,
): PreparedRange | undefined {
  const start = Math.max(0, Math.min(MINUTES_PER_DAY, range.start));
  const end = Math.max(0, Math.min(MINUTES_PER_DAY, range.end));
  if (end < start || (end === start && range.end !== range.start)) {
    return undefined;
  }

  const startPosition = getDayPosition(start);
  const pointOnly = end === start;
  const endPosition = pointOnly ? startPosition : getDayPosition(end, true);
  const segments = pointOnly
    ? []
    : [
        {
          key: `${index}-${start}-${end}`,
          startPosition,
          endPosition,
        },
      ];
  const events: TimelineEvent[] = [
    {
      key: `${index}-start`,
      position: startPosition,
      text: formatClockTime(start),
      edge: 'start',
    },
  ];
  if (!pointOnly) {
    events.push({
      key: `${index}-end`,
      position: endPosition,
      text: formatClockTime(end, { endOfDay: true }),
      edge: 'end',
    });
  }

  return {
    segments,
    events,
    labelPosition: pointOnly ? startPosition : getLabelPosition(segments),
  };
}

export function prepareWrappedRange(
  range: TimeRangeTimelineRange,
  index: number,
): PreparedRange | undefined {
  const duration = range.end - range.start;
  if (duration < 0) {
    return undefined;
  }

  const start = normalizeDayMinute(range.start);
  const end = start + duration;
  const startPosition = getDayPosition(start);
  const pointOnly = duration === 0;
  const endPosition = pointOnly ? startPosition : getDayPosition(end, true);
  let segments: PositionedRange[] = [];

  if (duration >= MINUTES_PER_DAY) {
    segments = [
      {
        key: `${index}-full-day`,
        startPosition: 0,
        endPosition: 100,
      },
    ];
  } else if (!pointOnly && end <= MINUTES_PER_DAY) {
    segments = [
      {
        key: `${index}-${start}-${end}`,
        startPosition,
        endPosition,
      },
    ];
  } else if (!pointOnly) {
    segments = [
      {
        key: `${index}-${start}-${MINUTES_PER_DAY}`,
        startPosition,
        endPosition: 100,
      },
      {
        key: `${index}-0-${end - MINUTES_PER_DAY}`,
        startPosition: 0,
        endPosition: getDayPosition(end),
      },
    ];
  }

  const events: TimelineEvent[] = [
    {
      key: `${index}-start`,
      position: startPosition,
      text: formatClockTime(start),
      edge: 'start',
    },
  ];
  if (!pointOnly) {
    events.push({
      key: `${index}-end`,
      position: endPosition,
      text: formatClockTime(end, { endOfDay: true }),
      edge: 'end',
    });
  }

  return {
    segments,
    events,
    labelPosition: pointOnly ? startPosition : getLabelPosition(segments),
  };
}

export function prepareRanges(
  ranges: readonly TimeRangeTimelineRange[],
  wrapAroundMidnight: boolean,
) {
  return ranges
    .map((range, index) =>
      wrapAroundMidnight
        ? prepareWrappedRange(range, index)
        : prepareClippedRange(range, index),
    )
    .filter((range): range is PreparedRange => range !== undefined);
}

export function positionEventLabels(
  events: readonly TimelineEvent[],
  separateEdgeLanes = false,
) {
  const positionedEvents = events
    .map((event) => ({ ...event }))
    .sort((left, right) => left.position - right.position);

  for (let index = 1; index < positionedEvents.length; index += 1) {
    const previous = positionedEvents[index - 1]!;
    const current = positionedEvents[index]!;
    if (
      current.position - previous.position >= 18 ||
      (separateEdgeLanes && current.edge !== previous.edge)
    ) {
      continue;
    }
    previous.labelDirection ??= 'left';
    current.labelDirection = 'right';
  }
  return positionedEvents;
}
