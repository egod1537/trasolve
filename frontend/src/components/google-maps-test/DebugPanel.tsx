import type {
  DirectionsRequest,
  DirectionsResult,
  MapRoute,
} from '../../maps/googleDirections';

type Props = {
  request: DirectionsRequest | null;
  result: DirectionsResult | null;
  route: MapRoute | undefined;
  logs: string[];
};

export function DebugPanel({ request, result, route, logs }: Props) {
  return (
    <details className="maps-test-debug">
      <summary>Debug / API 정보</summary>
      <div className="maps-test-debug-content">
        <section aria-label="Request">
          <h2>Request · 마지막 요청값</h2>
          <pre>{request ? JSON.stringify(request, null, 2) : '요청 대기'}</pre>
        </section>
        {route && (
          <details>
            <summary>Route polyline ({route.path.length}개 좌표)</summary>
            <pre>{JSON.stringify(route.path, null, 2)}</pre>
          </details>
        )}
        <details>
          <summary>Raw Response</summary>
          <pre>
            {result ? JSON.stringify(result.rawResponse, null, 2) : '응답 없음'}
          </pre>
        </details>
        <section aria-label="이벤트 로그">
          <h2>이벤트 로그</h2>
          <pre>{logs.join('\n') || '이벤트 대기'}</pre>
        </section>
      </div>
    </details>
  );
}
