import { ScrollArea } from '@/shared/ui/ScrollArea';
import type { TripPolylineMode } from '@trasolve/shared';
import type { RoutableMode } from '../domain/routeDetails';
import type {
  RouteQueryFailure,
  RouteQueryState,
} from '../model/routeQueryState';
import { ROUTE_MODES } from '../model/useRouteOptions';
import { formatPolylineMode, formatRouteDuration } from '../lib/mapFormatters';
import { PolylineModeIcon } from './PolylineModeIcon';
import { useL, type Localize } from '@/shared/i18n';

export function formatRouteFailure(
  failure: RouteQueryFailure,
  L: Localize,
): string {
  switch (failure.kind) {
    case 'not-found':
      return L(
        'map:polylineMetrics.formatPolylineDistance.text.noRouteInformation',
      );
    case 'timeout':
      return L('errors:chat.error.waitingTimeReplyHasBeenExceeded');
    case 'configuration':
      return L(
        'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.noRouteLookupProviderSetUp',
      );
    case 'unavailable':
      return failure.httpStatus === null
        ? L('errors:trips.error.unableConnectTravelServer')
        : L('errors:routes.error.routeLookupFailedHttp', {
            status: failure.httpStatus,
          });
  }
}

function durationLabel(state: RouteQueryState, L: Localize): string {
  if (state.status === 'idle') {
    return '';
  }
  if (state.status === 'loading') {
    return '…';
  }
  if (state.status === 'error') {
    return formatRouteFailure(state.failure, L);
  }
  const duration = state.routes[0]?.durationMillis;
  return duration === null || duration === undefined
    ? L(
        'map:routeSettingsCard.resolveDurationPresentation.ariaLabel.noEstimatedTime',
      )
    : formatRouteDuration(duration, L);
}

export function RouteModeTabs({
  mode,
  states,
  disabled,
  onSelect,
}: {
  mode: TripPolylineMode;
  states: Record<RoutableMode, RouteQueryState>;
  disabled: boolean;
  onSelect: (mode: TripPolylineMode) => void;
}) {
  const L = useL();
  return (
    <ScrollArea
      className="route-settings-mode-scroll"
      contentClassName="route-settings-mode-scroll-content"
      orientation="horizontal"
    >
      <div
        className="route-settings-modes"
        role="group"
        aria-label={L('map:routeSettingsCard.ariaLabel.chooseMethodTravel')}
      >
        {ROUTE_MODES.map((option) => (
          <button
            key={option}
            className="route-settings-mode"
            type="button"
            aria-pressed={mode === option}
            disabled={disabled}
            onClick={() => onSelect(option)}
            title={
              option === 'straight'
                ? undefined
                : durationLabel(states[option], L)
            }
          >
            <span className="route-settings-mode-primary">
              <PolylineModeIcon mode={option} />
            </span>
            <span className="route-settings-mode-label">
              {formatPolylineMode(option, L)}
            </span>
            {option !== 'straight' && (
              <small>
                {states[option].status === 'error'
                  ? states[option].failure.kind === 'not-found'
                    ? L(
                        'map:polylineMetrics.formatPolylineDistance.text.noRouteInformation',
                      )
                    : L('common:status.error')
                  : durationLabel(states[option], L)}
              </small>
            )}
            <span
              className="route-settings-mode-indicator"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
