import type { TripPlace } from '@trasolve/shared';
import type { ReactNode } from 'react';
import type { RouteOptimizationSchedule } from '@/features/route-optimization/model/routeOptimization';
import { useL } from '@/shared/i18n';
import {
  SchedulePlace,
  ScheduleLeg,
} from '@/features/route-optimization/ui/SchedulePlace';
import {
  getStayMinutes,
  addMinutes,
  getForwardMinutes,
} from '@/features/route-optimization/ui/schedulePreviewClock';

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
  const visitedIds = new Set(schedule.placeIds);
  const skippedPlaces = places.filter((place) => !visitedIds.has(place.id));
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
        {skippedPlaces.map((place) => (
          <li key={place.id} className="is-skipped">
            <div className="route-optimization-schedule-stop">
              <span
                className="route-optimization-schedule-index"
                aria-hidden="true"
              >
                ×
              </span>
              <div className="route-optimization-schedule-place">
                <div className="route-optimization-schedule-place-heading">
                  <strong>
                    <s>{place.name}</s>
                  </strong>
                </div>
              </div>
            </div>
          </li>
        ))}
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
