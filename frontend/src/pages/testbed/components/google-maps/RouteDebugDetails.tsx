import type { DirectionsResult, MapRoute } from '@trasolve/shared';
import { useState } from 'react';
import { NL, useL } from '@/shared/i18n';

export function RouteDebugDetails({
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
