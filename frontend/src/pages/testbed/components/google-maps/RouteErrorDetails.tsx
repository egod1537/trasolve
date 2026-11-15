import type { DirectionsRequest } from '@trasolve/shared';
import { useState } from 'react';
import type { DirectionsApiError } from '@/shared/api/routes';
import { NL, useL } from '@/shared/i18n';

export function RouteErrorDetails({
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
