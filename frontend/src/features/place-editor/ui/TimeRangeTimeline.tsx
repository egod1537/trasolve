import { useTimeRangeInteraction } from '@/features/place-editor/model/useTimeRangeInteraction';

import { formatClockTime } from '@/entities/place';
import '@/features/place-editor/ui/time-range-timeline.css';

import {
  type Props,
  type PositionedStyle,
  type RangeStyle,
} from '@/features/place-editor/ui/timeRangeTypes';
import {
  MINUTES_PER_DAY,
  DAY_TICKS,
  getDayPosition,
  getTimelinePositionClass,
} from '@/features/place-editor/ui/timeRangeGeometry';
export { type TimeRangeTimelineRange } from '@/features/place-editor/ui/timeRangeTypes';
export { MINUTES_PER_DAY } from '@/features/place-editor/ui/timeRangeGeometry';

export function TimeRangeTimeline({
  ranges,
  backgroundRanges = [],
  backgroundRangeLabel,
  ariaLabel,
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
  const {
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
  } = useTimeRangeInteraction({
    ranges,
    backgroundRanges,
    backgroundRangeLabel,
    ariaLabel,
    tone,
    variant,
    wrapAroundMidnight,
    editable,
    disabled,
    stepMinutes,
    minimumRangeMinutes,
    onRangeChange,
    onRangeChangeEnd,
    onCreateRange,
  });
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
        aria-label={
          rangeCreatable
            ? L('place:timeRangeTimeline.ariaLabel.selectVisitStartTime')
            : undefined
        }
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
            ? L(
                'place:timeRangeTimeline.tooltip.selectVisitStartTimeByClicking',
              )
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
                    ? L(
                        'place:timeRangeTimeline.ariaLabel.adjustVisitStartTime',
                      )
                    : L(
                        'place:timeRangeTimeline.ariaLabel.adjustmentStayEndTime',
                      )
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
                title={L(
                  'place:timeRangeTimeline.tooltip.adjustByDraggingUsingLeftRight',
                )}
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
      </span>
    </span>
  );
}
