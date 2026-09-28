import type {
  DirectionsRequest,
  DirectionsResult,
  MapRoute,
} from '@trasolve/shared';
import { useState } from 'react';
import type { DirectionsApiError } from '@/shared/api/routes';
import type { ApiStatus } from '@/pages/testbed/components/google-maps/types';
import {
  buildRouteItinerary,
  buildRouteSummary,
  type ItineraryEndpointModel,
  type ItineraryStepModel,
  type RouteSummaryModel,
} from '@/pages/testbed/components/google-maps/routeResultModel';
import { NL, useL } from '@/shared/i18n';

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

function RouteErrorDetails({
  error,
  request,
}: {
  error: DirectionsApiError;
  request: DirectionsRequest | null;
}) {
  const L = useL();
  const [expanded, setExpanded] = useState(false);
  const details = error.details;
  const requestDetails =
    details?.request ??
    (request
      ? {
          travelMode: request.travelMode ?? 'DRIVING',
          originType: request.origin.type,
          destinationType: request.destination.type,
          computeAlternativeRoutes: request.computeAlternativeRoutes ?? false,
          intermediatesCount: request.intermediates?.length ?? 0,
        }
      : null);
  const transitUnavailable =
    error.code === 'ROUTE_NOT_FOUND' &&
    requestDetails?.travelMode === 'TRANSIT';

  return (
    <section className="maps-test-route-error" role="alert">
      <h3>
        {L('testbed:routeResultPanel.text.pathFindingFailure', {
          code: error.code,
        })}
      </h3>
      <p>{error.message}</p>
      {transitUnavailable && (
        <p className="maps-test-route-error-note">
          {L(
            'testbed:routeResultPanel.routeErrorDetails.description.ifRouteJapanYouMayBe',
          )}
        </p>
      )}
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>
          {L(
            'testbed:routeResultPanel.routeErrorDetails.text.failureDebugDetails',
          )}
        </summary>
        {expanded ? (
          <div className="maps-test-route-debug-content">
            <dl className="maps-test-data">
              <dt>
                {L(
                  'testbed:routeResultPanel.routeErrorDetails.label.backendHttp',
                )}
              </dt>
              <dd>
                {error.httpStatus ||
                  L(
                    'testbed:routeResultPanel.routeErrorDetails.text.unableConfirm',
                  )}
              </dd>
              <dt>
                {L(
                  'testbed:routeResultPanel.routeErrorDetails.label.googleHttp',
                )}
              </dt>
              <dd>
                {details?.upstream.httpStatus ??
                  L(
                    'testbed:routeResultPanel.routeErrorDetails.text.unableConfirm',
                  )}
              </dd>
              <dt>
                {L(
                  'testbed:routeResultPanel.routeErrorDetails.label.googleStatus',
                )}
              </dt>
              <dd>
                {details?.upstream.status ??
                  L(
                    'testbed:routeResultPanel.routeErrorDetails.text.noneResponse',
                  )}
              </dd>
              <dt>
                {L(
                  'testbed:routeResultPanel.routeErrorDetails.label.googleMessage',
                )}
              </dt>
              <dd>
                {details?.upstream.message ??
                  L(
                    'testbed:routeResultPanel.routeErrorDetails.text.noneResponse',
                  )}
              </dd>
              <dt>
                {L(
                  'testbed:routeResultPanel.routeErrorDetails.label.travelMode',
                )}
              </dt>
              <dd>
                {requestDetails?.travelMode ??
                  L(
                    'testbed:routeResultPanel.routeErrorDetails.text.unableConfirm',
                  )}
              </dd>
              <dt>
                {L(
                  'testbed:routeResultPanel.routeErrorDetails.label.originType',
                )}
              </dt>
              <dd>
                {requestDetails?.originType ??
                  L(
                    'testbed:routeResultPanel.routeErrorDetails.text.unableConfirm',
                  )}
              </dd>
              <dt>
                {L(
                  'testbed:routeResultPanel.routeErrorDetails.label.destinationType',
                )}
              </dt>
              <dd>
                {requestDetails?.destinationType ??
                  L(
                    'testbed:routeResultPanel.routeErrorDetails.text.unableConfirm',
                  )}
              </dd>
              <dt>{NL('Alternatives')}</dt>
              <dd>
                {requestDetails
                  ? String(requestDetails.computeAlternativeRoutes)
                  : L(
                      'testbed:routeResultPanel.routeErrorDetails.text.unableConfirm',
                    )}
              </dd>
              <dt>{NL('Intermediates')}</dt>
              <dd>
                {requestDetails?.intermediatesCount ??
                  L(
                    'testbed:routeResultPanel.routeErrorDetails.text.unableConfirm',
                  )}
              </dd>
            </dl>
            {details && (
              <>
                <details>
                  <summary>
                    {L(
                      'testbed:routeResultPanel.routeErrorDetails.text.googleRequestBody',
                    )}
                  </summary>
                  <pre>
                    {JSON.stringify(details.upstream.requestBody, null, 2)}
                  </pre>
                </details>
                {details.upstream.rawErrorBody !== undefined && (
                  <details>
                    <summary>
                      {L(
                        'testbed:routeResultPanel.routeErrorDetails.text.googleSourceErrorEmptyResponse',
                      )}
                    </summary>
                    <pre>
                      {JSON.stringify(details.upstream.rawErrorBody, null, 2)}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
        ) : null}
      </details>
    </section>
  );
}

function RouteSummary({
  routeIndex,
  summary,
}: {
  routeIndex: number;
  summary: RouteSummaryModel;
}) {
  const L = useL();
  const items = [
    [
      L('testbed:routeResultPanel.routeSummary.text.totalTimeRequired'),
      summary.duration,
    ],
    [
      L('testbed:routeResultPanel.routeSummary.text.totalDistance'),
      summary.distance,
    ],
    [
      L('testbed:routeResultPanel.routeSummary.text.estimatedCost'),
      summary.fare,
    ],
    [
      L('testbed:jobRequestSummary.label.meansTransportation'),
      summary.travelModes,
    ],
  ];
  return (
    <section
      className="maps-test-route-summary"
      aria-labelledby="maps-test-route-summary-title"
    >
      <h3 id="maps-test-route-summary-title">
        {L('testbed:routeResultPanel.text.pathSummary', {
          value: routeIndex + 1,
        })}
      </h3>
      <dl>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ItineraryEndpoint({ endpoint }: { endpoint: ItineraryEndpointModel }) {
  return (
    <div className="maps-test-itinerary-endpoint">
      <span aria-hidden="true" />
      <div>
        <strong>{endpoint.title}</strong>
        <small>{endpoint.location}</small>
      </div>
    </div>
  );
}

function ItineraryStep({ step }: { step: ItineraryStepModel }) {
  return (
    <li className="maps-test-itinerary-step">
      <span className="maps-test-itinerary-mode">{step.modeLabel}</span>
      <div className="maps-test-itinerary-step-content">
        <strong>{step.title}</strong>
        <p>{step.details.join(' · ')}</p>
        {step.stopLabel && <p>{step.stopLabel}</p>}
        {step.headsign && <small>{step.headsign}</small>}
        {step.instruction && <small>{step.instruction}</small>}
      </div>
    </li>
  );
}

function RouteDebugDetails({
  route,
  result,
}: {
  route: MapRoute | undefined;
  result: DirectionsResult;
}) {
  const L = useL();
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="maps-test-route-debug"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        {L('testbed:routeResultPanel.routeDebugDetails.text.debugDetails')}
        {route &&
          route.warnings.length > 0 &&
          L('testbed:routeResultPanel.routeDebugDetails.text.warnings', {
            length: route.warnings.length,
          })}
      </summary>
      {expanded ? (
        <div className="maps-test-route-debug-content">
          {result.debug && (
            <section
              aria-label={L(
                'testbed:routeResultPanel.routeDebugDetails.ariaLabel.googleRequestDiagnostics',
              )}
            >
              <h3>
                {L(
                  'testbed:routeResultPanel.routeDebugDetails.ariaLabel.googleRequestDiagnostics',
                )}
              </h3>
              <dl className="maps-test-data">
                <dt>{NL('HTTP')}</dt>
                <dd>{result.debug.upstream.httpStatus}</dd>
                <dt>
                  {L(
                    'testbed:routeResultPanel.routeErrorDetails.label.travelMode',
                  )}
                </dt>
                <dd>{result.debug.request.travelMode}</dd>
                <dt>
                  {L(
                    'testbed:routeResultPanel.routeErrorDetails.label.originType',
                  )}
                </dt>
                <dd>{result.debug.request.originType}</dd>
                <dt>
                  {L(
                    'testbed:routeResultPanel.routeErrorDetails.label.destinationType',
                  )}
                </dt>
                <dd>{result.debug.request.destinationType}</dd>
                <dt>{NL('Alternatives')}</dt>
                <dd>{String(result.debug.request.computeAlternativeRoutes)}</dd>
                <dt>{NL('Intermediates')}</dt>
                <dd>{result.debug.request.intermediatesCount}</dd>
                <dt>{NL('languageCode')}</dt>
                <dd>{result.debug.request.languageCode}</dd>
                <dt>{NL('regionCode')}</dt>
                <dd>{result.debug.request.regionCode}</dd>
              </dl>
              <details>
                <summary>
                  {L(
                    'testbed:routeResultPanel.routeErrorDetails.text.googleRequestBody',
                  )}
                </summary>
                <pre>
                  {JSON.stringify(result.debug.upstream.requestBody, null, 2)}
                </pre>
              </details>
            </section>
          )}
          {route && (
            <>
              <section
                aria-label={L(
                  'testbed:routeResultPanel.routeDebugDetails.ariaLabel.selectionPathSourceField',
                )}
              >
                <h3>
                  {L(
                    'testbed:routeResultPanel.routeDebugDetails.ariaLabel.selectionPathSourceField',
                  )}
                </h3>
                <dl className="maps-test-data">
                  <dt>
                    {L(
                      'testbed:routeResultPanel.routeDebugDetails.label.description',
                    )}
                  </dt>
                  <dd>
                    {route.description ||
                      L(
                        'testbed:routeResultModel.nOTAVAILABLE.text.notProvided',
                      )}
                  </dd>
                  <dt>
                    {L(
                      'testbed:routeResultPanel.routeDebugDetails.label.coordinates',
                    )}
                  </dt>
                  <dd>
                    {L('testbed:jobBuilderLocationList.text.message', {
                      length: route.path.length,
                    })}
                  </dd>
                  <dt>{NL('bounds')}</dt>
                  <dd>
                    {route.bounds
                      ? L('testbed:routeResultPanel.routeDebugDetails.text.yes')
                      : L(
                          'testbed:routeResultPanel.routeDebugDetails.text.none',
                        )}
                  </dd>
                </dl>
              </section>
              <section aria-label={NL('Warnings')}>
                <h3>{NL('Warnings')}</h3>
                {route.warnings.length ? (
                  <ul>
                    {route.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {L('testbed:routeResultPanel.routeDebugDetails.text.none')}
                  </p>
                )}
              </section>
            </>
          )}
          <details>
            <summary>
              {L(
                'testbed:routeResultPanel.routeDebugDetails.text.rawApiResponse',
              )}
            </summary>
            <pre>{JSON.stringify(result.rawResponse, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </details>
  );
}

function getRouteKey(route: MapRoute): string {
  return [
    route.description,
    route.durationMillis,
    route.distanceMeters,
    ...route.path.flatMap((point) => [point.lat, point.lng]),
  ].join(':');
}
