import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { formatClockTime } from '../domain/clockFormat';
import '../styles/time-range-timeline.css';

export type TimeRangeTimelineRange = {
  start: number;
  end: number;
};

type Props = {
  ranges: readonly TimeRangeTimelineRange[];
  backgroundRanges?: readonly TimeRangeTimelineRange[];
  backgroundRangeLabel?: string;
  ariaLabel: string;
  rangeLabel?: string;
  tone?: 'primary' | 'opening' | 'warning' | 'muted';
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

type PositionedStyle = CSSProperties & {
  '--timeline-position': string;
};

type RangeStyle = CSSProperties & {
  '--timeline-start': string;
  '--timeline-size': string;
};

type PositionedRange = {
  key: string;
  startPosition: number;
  endPosition: number;
};

type TimelineEvent = {
  key: string;
  position: number;
  text: string;
  edge: 'start' | 'end';
  labelDirection?: 'left' | 'right';
};

type PreparedRange = {
  segments: PositionedRange[];
  events: TimelineEvent[];
  labelPosition: number;
};

type DayTick = {
  minute: number;
  label: string;
  edge?: 'start' | 'end';
};

type RangeEdge = 'start' | 'end';

type RangeEdit = {
  edge: RangeEdge;
  initialRange: TimeRangeTimelineRange;
  lastRange: TimeRangeTimelineRange;
};

type PointerRangeEdit = RangeEdit & {
  pointerId: number;
};

export const MINUTES_PER_DAY = 24 * 60;

const DAY_TICKS: readonly DayTick[] = [
  { minute: 0, label: '00:00', edge: 'start' },
  { minute: 6 * 60, label: '06:00' },
  { minute: 12 * 60, label: '12:00' },
  { minute: 18 * 60, label: '18:00' },
  { minute: MINUTES_PER_DAY, label: '24:00', edge: 'end' },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function snapTimelineMinute(minute: number, stepMinutes: number): number {
  return Math.round(minute / stepMinutes) * stepMinutes;
}

function getMinuteFromPointerPosition(
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

function updateEditableRange(
  range: TimeRangeTimelineRange,
  edge: RangeEdge,
  minute: number,
  stepMinutes: number,
  minimumRangeMinutes: number,
): TimeRangeTimelineRange {
  if (edge === 'start') {
    const maximumStart =
      Math.floor((range.end - minimumRangeMinutes) / stepMinutes) * stepMinutes;
    return { ...range, start: clamp(minute, 0, maximumStart) };
  }
  const minimumEnd =
    Math.ceil((range.start + minimumRangeMinutes) / stepMinutes) * stepMinutes;
  return { ...range, end: clamp(minute, minimumEnd, MINUTES_PER_DAY) };
}

function isSameRange(
  left: TimeRangeTimelineRange,
  right: TimeRangeTimelineRange,
): boolean {
  return left.start === right.start && left.end === right.end;
}

function getEditableRange(
  ranges: readonly TimeRangeTimelineRange[],
  minimumRangeMinutes: number,
): TimeRangeTimelineRange | null {
  if (ranges.length !== 1) {
    return null;
  }
  const range = ranges[0]!;
  return range.start >= 0 &&
    range.end <= MINUTES_PER_DAY &&
    range.end - range.start >= minimumRangeMinutes
    ? range
    : null;
}

function normalizeDayMinute(minute: number): number {
  return ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function getDayPosition(minute: number, endOfDay = false): number {
  const normalized = normalizeDayMinute(minute);
  const dayMinute =
    endOfDay && minute > 0 && normalized === 0 ? MINUTES_PER_DAY : normalized;
  return (dayMinute / MINUTES_PER_DAY) * 100;
}

function getTimelinePositionClass(position: number): string {
  if (position <= 8) {
    return ' is-start-edge';
  }
  if (position >= 92) {
    return ' is-end-edge';
  }
  return '';
}

function getLabelPosition(segments: readonly PositionedRange[]): number {
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

function prepareClippedRange(
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

function prepareWrappedRange(
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

function prepareRanges(
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

function positionEventLabels(events: readonly TimelineEvent[]) {
  const positionedEvents = events
    .map((event) => ({ ...event }))
    .sort((left, right) => left.position - right.position);

  for (let index = 1; index < positionedEvents.length; index += 1) {
    const previous = positionedEvents[index - 1]!;
    const current = positionedEvents[index]!;
    if (current.position - previous.position >= 18) {
      continue;
    }
    previous.labelDirection ??= 'left';
    current.labelDirection = 'right';
  }
  return positionedEvents;
}

export function TimeRangeTimeline({
  ranges,
  backgroundRanges = [],
  backgroundRangeLabel,
  ariaLabel,
  rangeLabel,
  tone = 'primary',
  variant = 'compact',
  wrapAroundMidnight = false,
  editable = false,
  disabled = false,
  stepMinutes = 15,
  minimumRangeMinutes = stepMinutes,
  onRangeChange,
  onRangeChangeEnd,
  onCreateRange,
}: Props) {
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
  );
  const labelPosition = preparedRanges[0]?.labelPosition;
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

  return (
    <span
      className={`time-range-timeline is-${tone} is-${variant}${hasBackgroundRanges ? ' has-background-ranges' : ''}${rangeInteractive ? ' is-editable' : ''}${rangeCreatable ? ' is-creatable' : ''}${disabled ? ' is-disabled' : ''}`}
      role={interactive ? 'group' : 'img'}
      aria-label={ariaLabel}
    >
      <span
        ref={axisRef}
        className="time-range-timeline-axis"
        aria-hidden={interactive ? undefined : true}
        role={rangeCreatable ? 'slider' : undefined}
        tabIndex={rangeCreatable && !disabled ? 0 : undefined}
        aria-label={rangeCreatable ? '방문 시작시간 선택' : undefined}
        aria-valuemin={rangeCreatable ? 0 : undefined}
        aria-valuemax={rangeCreatable ? MINUTES_PER_DAY : undefined}
        aria-valuenow={rangeCreatable ? creationMinute : undefined}
        aria-valuetext={
          rangeCreatable
            ? formatClockTime(creationMinute, { endOfDay: true })
            : undefined
        }
        aria-disabled={rangeCreatable ? disabled : undefined}
        title={
          rangeCreatable
            ? '클릭하거나 방향키와 Enter로 방문 시작시간 선택'
            : undefined
        }
        onClick={createRangeFromClick}
        onKeyDown={moveCreationMinute}
        onFocus={() => setCreationFocused(true)}
        onBlur={() => setCreationFocused(false)}
      >
        <span className="time-range-timeline-baseline" aria-hidden="true" />
        {positionedBackgroundRanges.map((range) => (
          <span
            key={`background-${range.key}`}
            className="time-range-timeline-background-range"
            aria-hidden="true"
            style={
              {
                '--timeline-start': `${range.startPosition}%`,
                '--timeline-size': `${range.endPosition - range.startPosition}%`,
              } as RangeStyle
            }
          />
        ))}
        {backgroundRangeLabel && backgroundLabelPosition !== undefined && (
          <small
            className={`time-range-timeline-background-label${getTimelinePositionClass(backgroundLabelPosition)}`}
            aria-hidden="true"
            style={
              {
                '--timeline-position': `${backgroundLabelPosition}%`,
              } as PositionedStyle
            }
          >
            {backgroundRangeLabel}
          </small>
        )}
        {backgroundEvents.map((event) => (
          <span
            key={`background-${event.key}`}
            className={`time-range-timeline-background-event is-${event.edge}${event.labelDirection ? ` is-label-${event.labelDirection}` : ''}${getTimelinePositionClass(event.position)}`}
            aria-hidden="true"
            style={
              {
                '--timeline-position': `${event.position}%`,
              } as PositionedStyle
            }
          >
            <time>{event.text}</time>
          </span>
        ))}
        {positionedRanges.map((range) => (
          <span
            key={range.key}
            className="time-range-timeline-range"
            aria-hidden="true"
            style={
              {
                '--timeline-start': `${range.startPosition}%`,
                '--timeline-size': `${range.endPosition - range.startPosition}%`,
              } as RangeStyle
            }
          />
        ))}
        {rangeCreatable && creationFocused && (
          <span
            className={`time-range-timeline-create-cursor${getTimelinePositionClass(
              getDayPosition(
                creationMinute,
                creationMinute === MINUTES_PER_DAY,
              ),
            )}`}
            aria-hidden="true"
            style={
              {
                '--timeline-position': `${getDayPosition(
                  creationMinute,
                  creationMinute === MINUTES_PER_DAY,
                )}%`,
              } as PositionedStyle
            }
          >
            <time>{formatClockTime(creationMinute, { endOfDay: true })}</time>
            <i />
          </span>
        )}
        {DAY_TICKS.map((tick) => (
          <span
            key={tick.minute}
            className={`time-range-timeline-tick${tick.edge ? ` is-${tick.edge}` : ''}`}
            aria-hidden="true"
            style={
              {
                '--timeline-position': `${getDayPosition(
                  tick.minute,
                  tick.edge === 'end',
                )}%`,
              } as PositionedStyle
            }
          >
            <time>{tick.label}</time>
          </span>
        ))}
        {events.map((event) => (
          <span
            key={event.key}
            className={`time-range-timeline-event is-${event.edge}${event.labelDirection ? ` is-label-${event.labelDirection}` : ''}${getTimelinePositionClass(event.position)}`}
            style={
              {
                '--timeline-position': `${event.position}%`,
              } as PositionedStyle
            }
          >
            <time aria-hidden={rangeInteractive ? true : undefined}>
              {event.text}
            </time>
            {rangeInteractive && editableRange ? (
              <button
                type="button"
                role="slider"
                className={`time-range-timeline-handle${activeEdge === event.edge ? ' is-dragging' : ''}`}
                aria-label={
                  event.edge === 'start'
                    ? '방문 시작시간 조정'
                    : '체류 종료시간 조정'
                }
                aria-orientation="horizontal"
                aria-valuemin={
                  event.edge === 'start'
                    ? 0
                    : editableRange.start + normalizedMinimumRangeMinutes
                }
                aria-valuemax={
                  event.edge === 'start'
                    ? editableRange.end - normalizedMinimumRangeMinutes
                    : MINUTES_PER_DAY
                }
                aria-valuenow={
                  event.edge === 'start'
                    ? editableRange.start
                    : editableRange.end
                }
                aria-valuetext={event.text}
                title="드래그하거나 좌우 방향키로 조정"
                disabled={disabled}
                onPointerDown={(pointerEvent) =>
                  startPointerEdit(pointerEvent, event.edge)
                }
                onPointerMove={movePointerEdit}
                onPointerUp={finishPointerEdit}
                onPointerCancel={cancelPointerEdit}
                onLostPointerCapture={cancelPointerEdit}
                onKeyDown={(keyboardEvent) =>
                  moveKeyboardEdit(keyboardEvent, event.edge)
                }
                onKeyUp={(keyboardEvent) =>
                  finishKeyboardEdit(event.edge, keyboardEvent.key)
                }
                onBlur={() => finishKeyboardEdit(event.edge)}
              />
            ) : (
              <i />
            )}
          </span>
        ))}
        {rangeLabel && labelPosition !== undefined && (
          <small
            className={`time-range-timeline-range-label${getTimelinePositionClass(labelPosition)}`}
            aria-hidden="true"
            style={
              {
                '--timeline-position': `${labelPosition}%`,
              } as PositionedStyle
            }
          >
            {rangeLabel}
          </small>
        )}
      </span>
    </span>
  );
}
