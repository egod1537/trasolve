import type { TripPlace } from '@trasolve/shared';
import { PlaceTimeTimeline } from '@/features/place-editor';
import { ScheduleLegTimeline } from '@/features/route-optimization/ui/ScheduleLegTimeline';
import { useL } from '@/shared/i18n';

export function SchedulePlace({
  index,
  place,
  time,
  arrivalTime,
  departureTime,
  waitMinutes,
  stayMinutes,
  endpointActions,
  endpointRole,
}: {
  index: number;
  place: TripPlace;
  time: string | null;
  arrivalTime?: string;
  departureTime: string | null;
  waitMinutes?: number;
  stayMinutes: number;
  endpointActions?: {
    isStart: boolean;
    isEnd: boolean;
    onSetStart: () => void;
    onSetEnd: () => void;
  };
  endpointRole?: 'start' | 'end';
}) {
  const L = useL();
  const resolvedEndpointRole = endpointActions?.isStart
    ? 'start'
    : endpointActions?.isEnd
      ? 'end'
      : endpointRole;
  return (
    <div
      className={`route-optimization-schedule-stop${resolvedEndpointRole ? ` is-${resolvedEndpointRole}-place` : ''}`}
    >
      <span className="route-optimization-schedule-index">{index + 1}</span>
      <div className="route-optimization-schedule-place">
        {resolvedEndpointRole ? (
          <span className="sr-only">
            {resolvedEndpointRole === 'start'
              ? L('routeOptimization:routeComparisonMap.text.startingPoint')
              : L('routeOptimization:routeComparisonMap.text.destination')}
          </span>
        ) : null}
        <div className="route-optimization-schedule-place-heading">
          <strong>{place.name}</strong>
          {endpointActions ? (
            <div className="route-optimization-endpoint-actions">
              <button
                type="button"
                className={`is-start${endpointActions.isStart ? ' is-active' : ''}`}
                aria-label={L(
                  'routeOptimization:routeSchedulePreview.schedulePlace.ariaLabel.setAsStartingPoint',
                  { name: place.name },
                )}
                aria-pressed={endpointActions.isStart}
                onClick={endpointActions.onSetStart}
              >
                {endpointActions.isStart
                  ? L(
                      'routeOptimization:routeEndpointContextMenu.action.startingPoint',
                    )
                  : L(
                      'routeOptimization:routeSchedulePreview.schedulePlace.action.start',
                    )}
              </button>
              <button
                type="button"
                className={`is-end${endpointActions.isEnd ? ' is-active' : ''}`}
                aria-label={L(
                  'routeOptimization:routeSchedulePreview.schedulePlace.ariaLabel.setAsDestination',
                  { name: place.name },
                )}
                aria-pressed={endpointActions.isEnd}
                onClick={endpointActions.onSetEnd}
              >
                {endpointActions.isEnd
                  ? L(
                      'routeOptimization:routeEndpointContextMenu.action.destinationPoint',
                    )
                  : L(
                      'routeOptimization:routeSchedulePreview.schedulePlace.action.arrival',
                    )}
              </button>
            </div>
          ) : (
            <span>
              {time && departureTime
                ? L(
                    'routeOptimization:routeSchedulePreview.schedulePlace.text.message',
                    { time: time, departureTime: departureTime },
                  )
                : L(
                    'routeOptimization:routeSchedulePreview.schedulePlace.text.timeNotSet',
                  )}
            </span>
          )}
        </div>
        {endpointActions ? (
          <span className="route-optimization-schedule-time">
            {time && departureTime
              ? L(
                  'routeOptimization:routeSchedulePreview.schedulePlace.text.message',
                  { time: time, departureTime: departureTime },
                )
              : L(
                  'routeOptimization:routeSchedulePreview.schedulePlace.text.timeNotSet',
                )}
          </span>
        ) : null}
        {time ? (
          <PlaceTimeTimeline
            time={time}
            visitDurationMinutes={stayMinutes}
            variant="compact"
          />
        ) : null}
        <div className="route-optimization-schedule-meta">
          {arrivalTime ? (
            <span>
              {L('routeOptimization:routeSchedulePreview.text.arrival', {
                arrivalTime: arrivalTime,
              })}
            </span>
          ) : null}
          {waitMinutes !== undefined ? (
            <span>
              {L('routeOptimization:routeSchedulePreview.text.waitMinutes', {
                waitMinutes: waitMinutes,
              })}
            </span>
          ) : null}
          <span>
            {L('routeOptimization:routeSchedulePreview.text.minutesStay', {
              stayMinutes: stayMinutes,
            })}
          </span>
          {departureTime ? (
            <span>
              {L('routeOptimization:routeSchedulePreview.text.departure', {
                departureTime: departureTime,
              })}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ScheduleLeg({
  label,
  minutes,
  startTime,
  endTime,
  kind = 'travel',
}: {
  label: string;
  minutes: number | null;
  startTime?: string | null;
  endTime?: string | null;
  kind?: 'travel' | 'wait';
}) {
  const L = useL();
  return (
    <div className={`route-optimization-schedule-leg is-${kind}`}>
      <span aria-hidden="true" />
      <div className="route-optimization-schedule-leg-content">
        <div className="route-optimization-schedule-leg-heading">
          <strong>{label}</strong>
          <span>
            {minutes === null
              ? '—'
              : L(
                  'routeOptimization:routeSchedulePreview.scheduleLeg.text.minutes',
                  { minutes: minutes },
                )}
          </span>
        </div>
        <ScheduleLegTimeline
          label={label}
          durationMinutes={minutes}
          startTime={startTime}
          endTime={endTime}
          kind={kind}
        />
      </div>
    </div>
  );
}
