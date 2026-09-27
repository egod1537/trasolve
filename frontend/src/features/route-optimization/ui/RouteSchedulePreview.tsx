import type { TripPlace } from '@trasolve/shared';
import type { ReactNode } from 'react';
import { PlaceTimeTimeline } from '@/features/place-editor';
import type { RouteOptimizationSchedule } from '@/features/route-optimization/model/routeOptimization';
import { ScheduleLegTimeline } from './ScheduleLegTimeline';
import { useL } from '@/shared/i18n';

type Props =
  | {
      variant: 'before';
      places: readonly TripPlace[];
      selectedStartPlaceId: string;
      selectedEndPlaceId: string;
      onSetStartPlace: (placeId: string) => void;
      onSetEndPlace: (placeId: string) => void;
    }
  | {
      variant: 'after';
      places: readonly TripPlace[];
      schedule: RouteOptimizationSchedule | null;
      selectedStartPlaceId: string;
      selectedEndPlaceId: string;
      running: boolean;
      hasResult: boolean;
    };

export function RouteSchedulePreview(props: Props) {
  return props.variant === 'before' ? (
    <BeforeSchedule
      places={props.places}
      selectedStartPlaceId={props.selectedStartPlaceId}
      selectedEndPlaceId={props.selectedEndPlaceId}
      onSetStartPlace={props.onSetStartPlace}
      onSetEndPlace={props.onSetEndPlace}
    />
  ) : (
    <AfterSchedule
      places={props.places}
      schedule={props.schedule}
      selectedStartPlaceId={props.selectedStartPlaceId}
      selectedEndPlaceId={props.selectedEndPlaceId}
      running={props.running}
      hasResult={props.hasResult}
    />
  );
}

function BeforeSchedule({
  places,
  selectedStartPlaceId,
  selectedEndPlaceId,
  onSetStartPlace,
  onSetEndPlace,
}: {
  places: readonly TripPlace[];
  selectedStartPlaceId: string;
  selectedEndPlaceId: string;
  onSetStartPlace: (placeId: string) => void;
  onSetEndPlace: (placeId: string) => void;
}) {
  const L = useL();
  return (
    <SchedulePanel
      title={L(
        'routeOptimization:routeSchedulePreview.beforeSchedule.tooltip.schedule',
      )}
      description={L(
        'routeOptimization:routeSchedulePreview.beforeSchedule.text.currentSchedule',
      )}
    >
      <ol className="route-optimization-schedule-list">
        {places.map((place, index) => {
          const stayMinutes = getStayMinutes(place);
          const departureTime = place.time
            ? addMinutes(place.time, stayMinutes)
            : null;
          const nextPlace = places[index + 1];
          const intervalMinutes =
            departureTime && nextPlace?.time
              ? getForwardMinutes(departureTime, nextPlace.time)
              : null;
          return (
            <li key={place.id}>
              <SchedulePlace
                index={index}
                place={place}
                time={place.time ?? null}
                departureTime={departureTime}
                stayMinutes={stayMinutes}
                endpointActions={{
                  isStart: place.id === selectedStartPlaceId,
                  isEnd: place.id === selectedEndPlaceId,
                  onSetStart: () => onSetStartPlace(place.id),
                  onSetEnd: () => onSetEndPlace(place.id),
                }}
              />
              {nextPlace ? (
                <ScheduleLeg
                  label={L(
                    'routeOptimization:routeSchedulePreview.beforeSchedule.text.untilNextSchedule',
                  )}
                  minutes={intervalMinutes}
                  startTime={departureTime}
                  endTime={nextPlace.time}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </SchedulePanel>
  );
}

function AfterSchedule({
  places,
  schedule,
  selectedStartPlaceId,
  selectedEndPlaceId,
  running,
  hasResult,
}: {
  places: readonly TripPlace[];
  schedule: RouteOptimizationSchedule | null;
  selectedStartPlaceId: string;
  selectedEndPlaceId: string;
  running: boolean;
  hasResult: boolean;
}) {
  const L = useL();
  if (!schedule) {
    return (
      <SchedulePanel
        title={L(
          'routeOptimization:routeSchedulePreview.beforeSchedule.tooltip.schedule',
        )}
        description={L(
          'routeOptimization:routeSchedulePreview.afterSchedule.text.optimizationSchedule',
        )}
      >
        <p
          className={`route-optimization-schedule-placeholder${running ? ' is-running' : ''}`}
          role="status"
        >
          {running
            ? L(
                'routeOptimization:routeSchedulePreview.afterSchedule.description.weCalculatingOptimizedSchedule',
              )
            : hasResult
              ? L(
                  'routeOptimization:routeSchedulePreview.afterSchedule.description.previewCannotBeCreatedBecauseItinerary',
                )
              : L(
                  'routeOptimization:routeSchedulePreview.afterSchedule.description.afterOptimizingYouCanSeeItinerary',
                )}
        </p>
      </SchedulePanel>
    );
  }

  const placesById = new Map(places.map((place) => [place.id, place]));
  return (
    <SchedulePanel
      title={L(
        'routeOptimization:routeSchedulePreview.beforeSchedule.tooltip.schedule',
      )}
      description={L(
        'routeOptimization:routeSchedulePreview.afterSchedule.text.optimizationSchedule',
      )}
    >
      <ol className="route-optimization-schedule-list">
        {schedule.stops.map((stop, index) => {
          const place = placesById.get(stop.placeId);
          const previousStop = schedule.stops[index - 1];
          if (!place) {
            return null;
          }
          return (
            <li key={stop.placeId}>
              {index > 0 ? (
                <ScheduleLeg
                  label={L(
                    'routeOptimization:routeSchedulePreview.afterSchedule.text.move',
                  )}
                  minutes={stop.travelMinutesFromPrevious}
                  startTime={previousStop?.departureTime}
                  endTime={stop.arrivalTime}
                />
              ) : null}
              {stop.waitMinutes > 0 ? (
                <ScheduleLeg
                  label={L(
                    'routeOptimization:routeOptimizationProgressDialog.formatStepState.text.waiting',
                  )}
                  minutes={stop.waitMinutes}
                  startTime={stop.arrivalTime}
                  endTime={stop.serviceStartTime}
                  kind="wait"
                />
              ) : null}
              <SchedulePlace
                index={index}
                place={place}
                time={stop.serviceStartTime}
                arrivalTime={stop.arrivalTime}
                departureTime={stop.departureTime}
                waitMinutes={stop.waitMinutes}
                stayMinutes={stop.stayMinutes}
                endpointRole={
                  stop.placeId === selectedStartPlaceId
                    ? 'start'
                    : stop.placeId === selectedEndPlaceId
                      ? 'end'
                      : undefined
                }
              />
            </li>
          );
        })}
      </ol>
    </SchedulePanel>
  );
}

function SchedulePanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="route-optimization-schedule-panel">
      <header>
        <strong>{title}</strong>
        <span>{description}</span>
      </header>
      {children}
    </article>
  );
}

function SchedulePlace({
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

function ScheduleLeg({
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

function getStayMinutes(place: TripPlace): number {
  return place.preferredDurationMinutes ?? place.visitDurationMinutes ?? 0;
}

function addMinutes(time: string, minutes: number): string | null {
  const total = clockToMinutes(time) + minutes;
  if (total < 0 || total >= 24 * 60) {
    return null;
  }
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
}

function getForwardMinutes(from: string, to: string): number | null {
  const difference = clockToMinutes(to) - clockToMinutes(from);
  return difference >= 0 ? difference : null;
}

function clockToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
