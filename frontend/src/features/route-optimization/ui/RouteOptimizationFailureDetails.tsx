import type { TripPlace, TrouteErrorPayload } from '@trasolve/shared';
import { useL } from '@/shared/i18n';

type Props = {
  error: TrouteErrorPayload | null;
  places: readonly TripPlace[];
};

type Suggestion = NonNullable<TrouteErrorPayload['suggestions']>[number];

export function RouteOptimizationFailureDetails({ error, places }: Props) {
  const L = useL();

  if (!error) {
    return null;
  }

  const detail = error?.failure_detail;
  const locationId = readString(detail, 'location_id');
  const placeName = findPlaceName(places, locationId);
  const fromPlaceName = findPlaceName(
    places,
    readString(detail, 'from_location_id'),
  );
  const toPlaceName = findPlaceName(
    places,
    readString(detail, 'to_location_id'),
  );
  const arrivalTime = readString(detail, 'arrival_time');
  const requiredDeparture = readString(detail, 'required_departure');
  const closeTime = readString(detail, 'close_time');
  const stayMinutes = readNumber(detail, 'stay_minutes');
  const suggestions = error.suggestions ?? [];
  const hasFactValues = Boolean(
    fromPlaceName ||
    toPlaceName ||
    arrivalTime ||
    requiredDeparture ||
    closeTime ||
    stayMinutes !== null,
  );
  const resolution = isScheduleFailure(error)
    ? L(
        'routeOptimization:routeOptimizationModal.getValidationResolution.text.checkLocationSBusinessHoursStay',
      )
    : L(
        'routeOptimization:routeOptimizationProgressDialog.getMessage.text.youCanRetryRequestClosePop',
      );

  return (
    <div className="route-optimization-failure-details">
      {placeName ? (
        <p className="route-optimization-failure-place">{placeName}</p>
      ) : null}
      {hasFactValues ? (
        <ul className="route-optimization-failure-facts">
          {fromPlaceName ? (
            <li>
              <span>
                {L('routeOptimization:routeComparisonMap.text.startingPoint')}
              </span>
              <strong>{fromPlaceName}</strong>
            </li>
          ) : null}
          {toPlaceName ? (
            <li>
              <span>
                {L('routeOptimization:routeComparisonMap.text.destination')}
              </span>
              <strong>{toPlaceName}</strong>
            </li>
          ) : null}
          {arrivalTime ? (
            <li>
              {L('routeOptimization:routeSchedulePreview.text.arrival', {
                arrivalTime,
              })}
            </li>
          ) : null}
          {stayMinutes !== null ? (
            <li>
              {L('routeOptimization:routeSchedulePreview.text.minutesStay', {
                stayMinutes,
              })}
            </li>
          ) : null}
          {requiredDeparture ? (
            <li>
              {L('routeOptimization:routeSchedulePreview.text.departure', {
                departureTime: requiredDeparture,
              })}
            </li>
          ) : null}
          {closeTime ? (
            <li>
              <span>{L('place:placeOpeningHours.text.closed')}</span>
              <strong>{closeTime}</strong>
            </li>
          ) : null}
        </ul>
      ) : null}
      {suggestions.length > 0 ? (
        <ul
          className="route-optimization-failure-suggestions"
          aria-label={L(
            'routeOptimization:routeOptimizationModal.getValidationResolution.text.checkLocationSBusinessHoursStay',
          )}
        >
          {suggestions.map((suggestion, index) => (
            <FailureSuggestion
              key={`${suggestion.type}-${index}`}
              suggestion={suggestion}
              places={places}
            />
          ))}
        </ul>
      ) : null}
      <p className="route-optimization-failure-resolution">{resolution}</p>
    </div>
  );
}

function isScheduleFailure(error: TrouteErrorPayload): boolean {
  const failureType = readString(error.failure_detail, 'type');
  return [error.code, failureType].some(
    (code) =>
      code === 'NO_FEASIBLE_ROUTE' ||
      code === 'NO_FEASIBLE_SCHEDULE' ||
      code === 'TIME_WINDOW_VIOLATION' ||
      code === 'INVALID_TIME_WINDOW' ||
      code === 'TIME_WINDOW_INVALID' ||
      code === 'INVALID_SCHEDULE_WINDOW',
  );
}

function FailureSuggestion({
  suggestion,
  places,
}: {
  suggestion: Suggestion;
  places: readonly TripPlace[];
}) {
  const L = useL();
  if (suggestion.type === 'START_EARLIER') {
    const current = readString(suggestion, 'current_value');
    const suggested =
      readString(suggestion, 'suggested_value') ??
      readString(suggestion, 'suggested_latest_start');
    if (!suggested) {
      return null;
    }
    return (
      <li>
        <span>
          {L(
            'routeOptimization:routeOptimizationModal.optimizationSettings.text.startTime',
          )}
        </span>
        {current ? <del>{current}</del> : null}
        <strong>{suggested}</strong>
      </li>
    );
  }

  if (suggestion.type === 'REDUCE_STAY_TIME') {
    const locationId = readString(suggestion, 'location_id');
    const placeName = findPlaceName(places, locationId);
    const current =
      readNumber(suggestion, 'current_minutes') ??
      readNumber(suggestion, 'current_value');
    const suggested =
      readNumber(suggestion, 'suggested_max_minutes') ??
      readNumber(suggestion, 'suggested_value');
    if (suggested === null) {
      return null;
    }
    return (
      <li>
        {placeName ? <span>{placeName}</span> : null}
        {current !== null ? (
          <del>
            {L('routeOptimization:routeSchedulePreview.text.minutesStay', {
              stayMinutes: current,
            })}
          </del>
        ) : null}
        <strong>
          {L('routeOptimization:routeSchedulePreview.text.minutesStay', {
            stayMinutes: suggested,
          })}
        </strong>
      </li>
    );
  }

  if (suggestion.type === 'REMOVE_LOCATION') {
    const locationId = readString(suggestion, 'location_id');
    const placeName = findPlaceName(places, locationId);
    if (!placeName) {
      return null;
    }
    return (
      <li>
        <span>{L('common:action.delete')}</span>
        <strong>{placeName}</strong>
      </li>
    );
  }

  if (suggestion.type === 'RETRY_ROUTING') {
    return (
      <li>
        <strong>{L('common:action.retry')}</strong>
      </li>
    );
  }

  return null;
}

function findPlaceName(
  places: readonly TripPlace[],
  locationId: string | null,
): string | null {
  if (!locationId) {
    return null;
  }
  return places.find((place) => place.id === locationId)?.name ?? locationId;
}

function readString(
  value: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const candidate = value?.[key];
  return typeof candidate === 'string' && candidate ? candidate : null;
}

function readNumber(
  value: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const candidate = value?.[key];
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? candidate
    : null;
}
