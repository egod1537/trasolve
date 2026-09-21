import type { DirectionsRequest, MapRoute } from '@trasolve/shared';
import { memo, useMemo, useState } from 'react';

type Props = {
  request: DirectionsRequest | null;
  route: MapRoute | undefined;
  logs: string[];
};

export function DebugPanel({ request, route, logs }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <details
      className="maps-test-debug"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>Debug / API 정보</summary>
      {expanded ? (
        <DebugPanelContent request={request} route={route} logs={logs} />
      ) : null}
    </details>
  );
}

const DebugPanelContent = memo(function DebugPanelContent({
  request,
  route,
  logs,
}: Props) {
  const requestJson = useMemo(
    () => (request ? JSON.stringify(request, null, 2) : '요청 대기'),
    [request],
  );
  const routePathJson = useMemo(
    () => (route ? JSON.stringify(route.path, null, 2) : null),
    [route],
  );
  const logText = useMemo(() => logs.join('\n') || '이벤트 대기', [logs]);

  return (
    <div className="maps-test-debug-content">
      <section aria-label="Request">
        <h2>Request · 마지막 요청값</h2>
        <pre>{requestJson}</pre>
      </section>
      {route && (
        <details>
          <summary>Route polyline ({route.path.length}개 좌표)</summary>
          <pre>{routePathJson}</pre>
        </details>
      )}
      <section aria-label="이벤트 로그">
        <h2>이벤트 로그</h2>
        <pre>{logText}</pre>
      </section>
    </div>
  );
});
