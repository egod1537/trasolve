import type { DirectionsRequest, MapRoute } from '@trasolve/shared';
import { memo, useMemo, useState } from 'react';
import { useL } from '@/shared/i18n';

type Props = {
  request: DirectionsRequest | null;
  route: MapRoute | undefined;
  logs: string[];
};

export function DebugPanel({ request, route, logs }: Props) {
  const L = useL();
  const [expanded, setExpanded] = useState(false);

  return (
    <details
      className="maps-test-debug"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{L('testbed:debugPanel.text.debugApiInformation')}</summary>
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
  const L = useL();
  const requestJson = useMemo(
    () =>
      request
        ? JSON.stringify(request, null, 2)
        : L('testbed:debugPanel.requestJson.text.waitingRequest'),
    [L, request],
  );
  const routePathJson = useMemo(
    () => (route ? JSON.stringify(route.path, null, 2) : null),
    [route],
  );
  const logText = useMemo(
    () => logs.join('\n') || L('testbed:debugPanel.logText.text.waitingEvent'),
    [L, logs],
  );

  return (
    <div className="maps-test-debug-content">
      <section aria-label={L('testbed:debugPanel.ariaLabel.request')}>
        <h2>
          {L(
            'testbed:debugPanel.debugPanelContent.title.requestLastRequestValue',
          )}
        </h2>
        <pre>{requestJson}</pre>
      </section>
      {route && (
        <details>
          <summary>
            {L('testbed:debugPanel.text.routePolylineCoordinates', {
              coordinateCount: route.path.length,
            })}
          </summary>
          <pre>{routePathJson}</pre>
        </details>
      )}
      <section
        aria-label={L(
          'testbed:debugPanel.debugPanelContent.ariaLabel.eventLog',
        )}
      >
        <h2>{L('testbed:debugPanel.debugPanelContent.ariaLabel.eventLog')}</h2>
        <pre>{logText}</pre>
      </section>
    </div>
  );
});
