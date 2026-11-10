import type {
  DirectionsRequest,
  DirectionsResult,
  MapRoute,
} from '@trasolve/shared';
import type { DirectionsApiError } from '@/shared/api/routes';
import type { ApiStatus } from '@/pages/testbed/components/google-maps/types';
import {
  buildRouteItinerary,
  buildRouteSummary,
} from '@/pages/testbed/components/google-maps/routeResultModel';
import { useL } from '@/shared/i18n';
import { RouteErrorDetails } from '@/pages/testbed/components/google-maps/RouteErrorDetails';
import {
  RouteSummary,
  ItineraryEndpoint,
  ItineraryStep,
  getRouteKey,
} from '@/pages/testbed/components/google-maps/RouteSummary';
import { RouteDebugDetails } from '@/pages/testbed/components/google-maps/RouteDebugDetails';

type Props = {
  apiStatus: ApiStatus;
  error: DirectionsApiError | null;
  request: DirectionsRequest | null;
  result: DirectionsResult | null;
  route: MapRoute | undefined;
  routeIndex: number;
  onSelectRoute: (index: number) => void;
  onFitBounds: () => void;
};

export function RouteResultPanel({
  apiStatus,
  error,
  request,
  result,
  route,
  routeIndex,
  onSelectRoute,
  onFitBounds,
}: Props) {
  const L = useL();
  const summary = route
    ? buildRouteSummary(route, result?.request.travelMode)
    : null;
  const itinerary =
    route && result ? buildRouteItinerary(route, result.request) : [];

  return (
    <section
      className="maps-test-results"
      aria-label={L('testbed:routeResultPanel.ariaLabel.directionsResults')}
    >
      <div className="maps-test-result-heading">
        <h2>{L('testbed:routeResultPanel.title.routeResult')}</h2>
        <p role="status">
          {L('testbed:routeResultPanel.description.routesApi')}{' '}
          <strong className="maps-test-api-status" data-status={apiStatus}>
            {apiStatus.toUpperCase()}
          </strong>
        </p>
      </div>
      {error && <RouteErrorDetails error={error} request={request} />}
      {result && (
        <p className="maps-test-route-count">
          {L('testbed:routeResultPanel.description.path')}
          {result.routes.length}
          {L('testbed:jobBuilderLocationList.text.dog')}
          {!result.routes.length &&
            L('testbed:routeResultPanel.description.noPathWasReturned')}
        </p>
      )}
      {result && result.routes.length > 0 && (
        <div
          className="maps-test-route-selector"
          aria-label={L('testbed:routeResultPanel.ariaLabel.selectRoute')}
        >
          {result.routes.map((item, index) => {
            const itemSummary = buildRouteSummary(
              item,
              result.request.travelMode,
            );
            return (
              <button
                type="button"
                className="maps-test-route-option"
                key={getRouteKey(item)}
                aria-pressed={routeIndex === index}
                onClick={() => onSelectRoute(index)}
                title={
                  item.description ||
                  L('testbed:routeResultPanel.text.path', { value: index + 1 })
                }
              >
                <strong>
                  {L('testbed:routeResultPanel.text.path', {
                    value: index + 1,
                  })}
                </strong>
                <span>{itemSummary.duration}</span>
                <small>
                  {itemSummary.distance} · {itemSummary.fare}
                </small>
              </button>
            );
          })}
        </div>
      )}
      {route && result && summary && (
        <>
          <RouteSummary routeIndex={routeIndex} summary={summary} />
          <section
            className="maps-test-itinerary-section"
            aria-labelledby="maps-test-itinerary-title"
          >
            <h3 id="maps-test-itinerary-title">
              {L('testbed:routeResultPanel.title.routeBySection')}
            </h3>
            <ol className="maps-test-itinerary">
              {itinerary.map((leg, legIndex) => (
                <li className="maps-test-itinerary-leg" key={leg.key}>
                  {legIndex === 0 && <ItineraryEndpoint endpoint={leg.start} />}
                  <ol
                    aria-label={L(
                      'testbed:routeResultPanel.ariaLabel.section',
                      { title: leg.start.title },
                    )}
                  >
                    {leg.steps.map((step) => (
                      <ItineraryStep key={step.key} step={step} />
                    ))}
                  </ol>
                  <ItineraryEndpoint endpoint={leg.end} />
                </li>
              ))}
            </ol>
          </section>
          <div className="maps-test-actions">
            <button
              type="button"
              disabled={!route.bounds}
              onClick={onFitBounds}
            >
              {L('testbed:routeResultPanel.action.fitMapSelectedRoute')}
            </button>
          </div>
        </>
      )}
      {result && <RouteDebugDetails route={route} result={result} />}
    </section>
  );
}
