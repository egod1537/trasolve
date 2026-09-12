import type {
  DirectionsRequest,
  DirectionsResult,
  MapRoute,
} from '@trasolve/shared';
import type { DirectionsApiError } from '../../../../api/routes';
import type { ApiStatus } from './types';
import {
  buildRouteItinerary,
  buildRouteSummary,
  type ItineraryEndpointModel,
  type ItineraryStepModel,
  type RouteSummaryModel,
} from './routeResultModel';

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
  const summary = route
    ? buildRouteSummary(route, result?.request.travelMode)
    : null;
  const itinerary =
    route && result ? buildRouteItinerary(route, result.request) : [];

  return (
    <section className="maps-test-results" aria-label="길찾기 결과">
      <div className="maps-test-result-heading">
        <h2>경로 결과</h2>
        <p role="status">
          Routes API{' '}
          <strong className="maps-test-api-status" data-status={apiStatus}>
            {apiStatus.toUpperCase()}
          </strong>
        </p>
      </div>
      {error && <RouteErrorDetails error={error} request={request} />}
      {result && (
        <p className="maps-test-route-count">
          경로 {result.routes.length}개
          {!result.routes.length && ' · 반환된 경로가 없습니다.'}
        </p>
      )}
      {result && result.routes.length > 0 && (
        <div className="maps-test-route-selector" aria-label="경로 선택">
          {result.routes.map((item, index) => {
            const itemSummary = buildRouteSummary(
              item,
              result.request.travelMode,
            );
            return (
              <button
                type="button"
                className="maps-test-route-option"
                key={index}
                aria-pressed={routeIndex === index}
                onClick={() => onSelectRoute(index)}
                title={item.description || `경로 ${index + 1}`}
              >
                <strong>경로 {index + 1}</strong>
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
            <h3 id="maps-test-itinerary-title">구간별 경로</h3>
            <ol className="maps-test-itinerary">
              {itinerary.map((leg, legIndex) => (
                <li className="maps-test-itinerary-leg" key={leg.key}>
                  {legIndex === 0 && <ItineraryEndpoint endpoint={leg.start} />}
                  <ol
                    aria-label={`${leg.start.title}에서 ${leg.end.title} 구간`}
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
              선택 경로에 지도 맞추기
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
      <h3>길찾기 실패 · {error.code}</h3>
      <p>{error.message}</p>
      {transitUnavailable && (
        <p className="maps-test-route-error-note">
          일본 경로라면 Google Maps Platform Routes API가 일본의 Google Transit
          파트너를 지원하지 않는 제한에 해당할 수 있습니다.
        </p>
      )}
      <details>
        <summary>실패 Debug Details</summary>
        <div className="maps-test-route-debug-content">
          <dl className="maps-test-data">
            <dt>Backend HTTP</dt>
            <dd>{error.httpStatus || '확인 불가'}</dd>
            <dt>Google HTTP</dt>
            <dd>{details?.upstream.httpStatus ?? '확인 불가'}</dd>
            <dt>Google status</dt>
            <dd>{details?.upstream.status ?? '응답에 없음'}</dd>
            <dt>Google message</dt>
            <dd>{details?.upstream.message ?? '응답에 없음'}</dd>
            <dt>Travel mode</dt>
            <dd>{requestDetails?.travelMode ?? '확인 불가'}</dd>
            <dt>Origin type</dt>
            <dd>{requestDetails?.originType ?? '확인 불가'}</dd>
            <dt>Destination type</dt>
            <dd>{requestDetails?.destinationType ?? '확인 불가'}</dd>
            <dt>Alternatives</dt>
            <dd>
              {requestDetails
                ? String(requestDetails.computeAlternativeRoutes)
                : '확인 불가'}
            </dd>
            <dt>Intermediates</dt>
            <dd>{requestDetails?.intermediatesCount ?? '확인 불가'}</dd>
          </dl>
          {details && (
            <>
              <details>
                <summary>Google 요청 본문</summary>
                <pre>
                  {JSON.stringify(details.upstream.requestBody, null, 2)}
                </pre>
              </details>
              {details.upstream.rawErrorBody !== undefined && (
                <details>
                  <summary>Google 원본 오류/빈 응답</summary>
                  <pre>
                    {JSON.stringify(details.upstream.rawErrorBody, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
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
  const items = [
    ['총 소요시간', summary.duration],
    ['총 거리', summary.distance],
    ['예상 비용', summary.fare],
    ['이동수단', summary.travelModes],
  ];
  return (
    <section
      className="maps-test-route-summary"
      aria-labelledby="maps-test-route-summary-title"
    >
      <h3 id="maps-test-route-summary-title">경로 {routeIndex + 1} 요약</h3>
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
  return (
    <details className="maps-test-route-debug">
      <summary>
        Debug Details
        {route &&
          route.warnings.length > 0 &&
          ` · warning ${route.warnings.length}개`}
      </summary>
      <div className="maps-test-route-debug-content">
        {result.debug && (
          <section aria-label="Google 요청 진단">
            <h3>Google 요청 진단</h3>
            <dl className="maps-test-data">
              <dt>HTTP</dt>
              <dd>{result.debug.upstream.httpStatus}</dd>
              <dt>Travel mode</dt>
              <dd>{result.debug.request.travelMode}</dd>
              <dt>Origin type</dt>
              <dd>{result.debug.request.originType}</dd>
              <dt>Destination type</dt>
              <dd>{result.debug.request.destinationType}</dd>
              <dt>Alternatives</dt>
              <dd>{String(result.debug.request.computeAlternativeRoutes)}</dd>
              <dt>Intermediates</dt>
              <dd>{result.debug.request.intermediatesCount}</dd>
            </dl>
            <details>
              <summary>Google 요청 본문</summary>
              <pre>
                {JSON.stringify(result.debug.upstream.requestBody, null, 2)}
              </pre>
            </details>
          </section>
        )}
        {route && (
          <>
            <section aria-label="선택 경로 원본 필드">
              <h3>선택 경로 원본 필드</h3>
              <dl className="maps-test-data">
                <dt>설명</dt>
                <dd>{route.description || '제공되지 않음'}</dd>
                <dt>좌표</dt>
                <dd>{route.path.length}개</dd>
                <dt>bounds</dt>
                <dd>{route.bounds ? '있음' : '없음'}</dd>
              </dl>
            </section>
            <section aria-label="Warnings">
              <h3>Warnings</h3>
              {route.warnings.length ? (
                <ul>
                  {route.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p>없음</p>
              )}
            </section>
          </>
        )}
        <details>
          <summary>Raw API Response</summary>
          <pre>{JSON.stringify(result.rawResponse, null, 2)}</pre>
        </details>
      </div>
    </details>
  );
}
