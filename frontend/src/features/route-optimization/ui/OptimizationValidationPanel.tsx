import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useState } from 'react';
import type {
  TripDay,
  RouteValidationIssue,
  TrouteErrorPayload,
} from '@trasolve/shared';
import type { RouteOptimizationIssue } from '@/features/route-optimization/model/routeOptimization';
import type { RouteOptimizationFailure } from '@/features/route-optimization/api/routeOptimizationApi';
import type { RouteValidationState } from '../model/useRouteValidation';
import { formatRouteOptimizationIssue } from './optimizationSettings';
import { RouteOptimizationFailureDetails } from './RouteOptimizationFailureDetails';
import { useL, type Localize } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import {
  ValidationSeverityTabs,
  type ValidationSeverity,
} from './ValidationSeverityTabs';

type Props = {
  id: string;
  day: TripDay;
  validation: RouteValidationState;
  error: RouteOptimizationFailure | null;
};
export function OptimizationValidationPanel({
  id,
  day,
  validation,
  error,
}: Props) {
  const L = useL();
  const { issues, result, checking, unknownHours } = validation;
  const [selected, setSelected] = useState<ValidationSeverity | null>(null);
  const counts = {
    warning:
      (result?.issues.filter((issue) => issue.severity === 'warning').length ??
        0) + Number(unknownHours.length > 0),
    error:
      issues.length +
      (result?.issues.filter((issue) => issue.severity === 'error').length ??
        0) +
      Number(Boolean(validation.error)) +
      Number(Boolean(error)),
  };
  const severity = selected ?? (counts.error > 0 ? 'error' : 'warning');
  const serverIssues =
    result?.issues.filter((issue) => issue.severity === severity) ?? [];
  const empty = counts[severity] === 0;
  if (
    !issues.length &&
    !result?.issues.length &&
    !checking &&
    !validation.error &&
    !error &&
    !unknownHours.length
  ) {
    return null;
  }
  return (
    <aside
      className="route-settings-side-panel route-settings-validation"
      aria-labelledby={`${id}-title`}
      data-severity={severity}
    >
      <header>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4m0 3v.1" />
        </svg>
        <h3 id={`${id}-title`}>
          {L(
            'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.scheduleConstraintVerification',
          )}
        </h3>
      </header>
      <p className="route-settings-validation-day">{day.title}</p>
      <ValidationSeverityTabs
        id={id}
        selected={severity}
        counts={counts}
        onSelect={setSelected}
      />
      {checking && (
        <p className="route-settings-validation-status" role="status">
          <LoadingSpinner />
          {L(
            'testbed:jobBuilderValidationIndicator.sTATUSDETAILS.label.verifying',
          )}
        </p>
      )}
      <ScrollArea
        key={severity}
        id={id}
        className="route-settings-validation-content"
        contentClassName="route-settings-validation-content-content"
        viewportProps={{
          role: 'tabpanel',
          'aria-labelledby': `${id}-tab-${severity}`,
          tabIndex: 0,
          'aria-live': 'polite',
          'aria-atomic': 'true',
        }}
      >
        {severity === 'error' &&
          issues.map(({ id: issueId, issue }) => (
            <LocalIssue key={`${issueId}-${issue.code}`} issue={issue} />
          ))}
        {serverIssues.map((issue, index) => (
          <ServerIssue
            key={`${issue.location_id}-${issue.code}-${index}`}
            issue={issue}
            day={day}
          />
        ))}
        {result?.matrix_source === 'euclidean' && serverIssues.length > 0 && (
          <p className="route-settings-validation-resolution">
            {L('routeOptimization:routeReviewSummary.basis')}
          </p>
        )}
        {severity === 'warning' && unknownHours.length > 0 && (
          <p className="route-settings-validation-resolution">
            {L(
              'routeOptimization:routeOptimizationModal.text.noBusinessHoursInformationOptimizationRequests',
              { placeNames: unknownHours.join(', ') },
            )}
          </p>
        )}
        {severity === 'error' && validation.error && (
          <div className="route-settings-validation-item">
            <p>{validation.error}</p>
            <Button onClick={validation.retry}>
              {L('common:action.retry')}
            </Button>
          </div>
        )}
        {severity === 'error' && error && (
          <div className="route-settings-validation-item">
            <p>{error.message}</p>
            <RouteOptimizationFailureDetails
              error={error.trouteError}
              places={day.places}
            />
          </div>
        )}
        {empty && !checking && (
          <p className="route-settings-validation-resolution">
            {L('admin:common.empty')}
          </p>
        )}
      </ScrollArea>
    </aside>
  );
}

function LocalIssue({ issue }: { issue: RouteOptimizationIssue }) {
  const L = useL();
  const resolution = getValidationResolution(issue, L);
  return (
    <div
      className="route-settings-validation-item"
      data-blocks-optimization="true"
    >
      {typeof issue.values?.name === 'string' && (
        <strong>{issue.values.name}</strong>
      )}
      <p>{formatRouteOptimizationIssue(issue, L)}</p>
      {resolution && (
        <p className="route-settings-validation-resolution">{resolution}</p>
      )}
    </div>
  );
}

function ServerIssue({
  issue,
  day,
}: {
  issue: RouteValidationIssue;
  day: TripDay;
}) {
  const L = useL();
  const place = day.places.find((place) => place.id === issue.location_id);
  const failure: TrouteErrorPayload = {
    code: issue.code,
    message: issue.message,
    ...(issue.failure_detail ? { failure_detail: issue.failure_detail } : {}),
    suggestions: issue.suggestions,
  };
  const message =
    issue.code === 'INVALID_REQUEST'
      ? L(
          'routeOptimization:routeOptimization.error.routeOptimizationRequestValueIncorrect',
        )
      : issue.code === 'UNREACHABLE_ARC'
        ? L(
            'map:polylineMetrics.formatPolylineDistance.text.noRouteInformation',
          )
        : L(
            'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.locationOpeningHoursVisitingHoursRange',
          );
  return (
    <div
      className="route-settings-validation-item"
      data-blocks-optimization={issue.blocks_optimization}
    >
      {place && !issue.failure_detail?.location_id && (
        <strong>{place.name}</strong>
      )}
      <p>{message}</p>
      <RouteOptimizationFailureDetails error={failure} places={day.places} />
    </div>
  );
}

function getValidationResolution(
  issue: RouteOptimizationIssue,
  L: Localize,
): string | null {
  switch (issue.code) {
    case 'minimumPlaces':
      return L(
        'routeOptimization:routeOptimizationModal.getValidationResolution.text.addAtLeastTwoLocationsThis',
      );
    case 'startOutsideDay':
    case 'endOutsideDay':
    case 'sameEndpoints':
      return L(
        'routeOptimization:routeOptimizationModal.getValidationResolution.text.selectDifferentLocationsCurrentDayAs',
      );
    case 'fixedStartRequired':
    case 'fixedStartStep':
      return L(
        'routeOptimization:routeOptimizationModal.getValidationResolution.text.enterStartTime10MinuteIncrements',
      );
    case 'unsupportedTravelMode':
      return L(
        'routeOptimization:routeOptimizationModal.getValidationResolution.text.setDaySModeTransportationAs',
      );
    case 'missingPlaceId':
      return L(
        'routeOptimization:routeOptimizationModal.getValidationResolution.text.selectPlaceDisplayedPlaceSearchAgain',
      );
    case 'stayStep':
    case 'nextDayOpeningHours':
    case 'noOpeningHours':
    case 'openingTimeStep':
    case 'closingTimeStep':
      return L(
        'routeOptimization:routeOptimizationModal.getValidationResolution.text.checkLocationSBusinessHoursStay',
      );
    default:
      return null;
  }
}
