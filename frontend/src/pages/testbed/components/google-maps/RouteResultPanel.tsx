import type { DirectionsResult, MapRoute } from '@trasolve/shared';
import type { ApiStatus } from './types';

function formatDistance(meters: number | null): string {
  return meters === null ? '제공되지 않음' : `${(meters / 1000).toFixed(2)} km`;
}

function formatDuration(milliseconds: number | null): string {
  return milliseconds === null
    ? '제공되지 않음'
    : `${Math.round(milliseconds / 60000)}분`;
}

type Props = {
  apiStatus: ApiStatus;
  error: string | null;
  result: DirectionsResult | null;
  route: MapRoute | undefined;
  routeIndex: number;
  onSelectRoute: (index: number) => void;
  onFitBounds: () => void;
};

export function RouteResultPanel({
  apiStatus,
  error,
  result,
  route,
  routeIndex,
  onSelectRoute,
  onFitBounds,
}: Props) {
  return (
    <section className="maps-test-results" aria-label="길찾기 결과">
      <h2>길찾기 결과</h2>
      <p role="status">
        Routes API{' '}
        <strong className="maps-test-api-status" data-status={apiStatus}>
          {apiStatus.toUpperCase()}
        </strong>
      </p>
      {error && <pre role="alert">{error}</pre>}
      {result && (
        <p>
          경로 개수: {result.routes.length}
          {!result.routes.length && ' · 반환된 경로가 없습니다.'}
        </p>
      )}
      {result && result.routes.length > 1 && (
        <div className="maps-test-actions" aria-label="경로 선택">
          {result.routes.map((item, index) => (
            <button
              type="button"
              key={index}
              aria-pressed={routeIndex === index}
              onClick={() => onSelectRoute(index)}
              title={item.description || `경로 ${index + 1}`}
            >
              경로 {index + 1}
            </button>
          ))}
        </div>
      )}
      {route && (
        <>
          <h3>경로 {routeIndex + 1}</h3>
          <dl className="maps-test-data">
            <dt>설명</dt>
            <dd>{route.description || '제공되지 않음'}</dd>
            <dt>거리</dt>
            <dd>{formatDistance(route.distanceMeters)}</dd>
            <dt>예상 시간</dt>
            <dd>{formatDuration(route.durationMillis)}</dd>
            <dt>warnings</dt>
            <dd>
              {route.warnings.length
                ? route.warnings.map((warning, index) => (
                    <p key={index}>{warning}</p>
                  ))
                : '없음'}
            </dd>
          </dl>
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
    </section>
  );
}
