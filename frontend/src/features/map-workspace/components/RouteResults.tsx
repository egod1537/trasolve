import { useCallback, useId, useState } from 'react';
import type { MapRoute } from '@trasolve/shared';
import type { RouteEndpoint, RoutableMode } from '../domain/routeDetails';
import { TRAVEL_MODES } from '../model/useRouteOptions';
import { buildRouteSummary } from '@/shared/lib/routePresentation';
import { useL } from '@/shared/i18n';
import { RouteDetailPopover } from './RouteDetailPopover';
import { RouteJourneyPreview } from './RouteJourneyPreview';
import { PolylineModeIcon } from './PolylineModeIcon';

export function RouteResults({
  routes,
  mode,
  from,
  to,
}: {
  routes: readonly MapRoute[];
  mode: RoutableMode;
  from: RouteEndpoint;
  to: RouteEndpoint;
}) {
  const [selected, setSelected] = useState(0);
  const L = useL();
  const detailId = useId();
  const [detail, setDetail] = useState<{
    index: number;
    trigger: HTMLButtonElement;
  } | null>(null);
  const visibleRoutes = mode === 'transit' ? routes.slice(0, 5) : routes;
  const detailRoute = detail ? visibleRoutes[detail.index] : undefined;
  const closeDetail = useCallback(
    (restoreFocus: boolean) => {
      if (restoreFocus && detail?.trigger.isConnected) {
        detail.trigger.focus({ preventScroll: true });
      }
      setDetail(null);
    },
    [detail],
  );
  return (
    <div
      className="route-results"
      aria-label={L('testbed:routeResultPanel.ariaLabel.directionsResults')}
    >
      {visibleRoutes.map((route, index) => {
        const summary = buildRouteSummary(route, TRAVEL_MODES[mode]);
        return (
          <article
            className="route-result-card"
            data-selected={selected === index}
            key={index}
          >
            <button
              className="route-result-select"
              type="button"
              aria-pressed={selected === index}
              onClick={() => {
                setSelected(index);
                setDetail(null);
              }}
            >
              <span className="route-result-label">
                {L('testbed:routeResultPanel.text.path', { value: index + 1 })}
              </span>
              <span className="route-result-facts">
                <strong>{summary.duration}</strong>
                <span>{summary.distance}</span>
                {mode !== 'walking' && route.fare && (
                  <span>{summary.fare}</span>
                )}
              </span>
            </button>
            {mode === 'transit' && <RouteJourneyPreview route={route} />}
            {mode === 'driving' && route.description.trim() && (
              <p className="route-result-road-summary">
                <PolylineModeIcon mode="driving" />
                <span>{route.description}</span>
              </p>
            )}
            {mode !== 'walking' && (
              <button
                className="route-result-details-trigger"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={detail?.index === index}
                aria-controls={detail?.index === index ? detailId : undefined}
                onClick={(event) => {
                  setSelected(index);
                  setDetail(
                    detail?.index === index
                      ? null
                      : { index, trigger: event.currentTarget },
                  );
                }}
              >
                {L('testbed:routeResultPanel.title.routeBySection')}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </button>
            )}
          </article>
        );
      })}
      {detail && detailRoute && mode !== 'walking' && (
        <RouteDetailPopover
          id={detailId}
          route={detailRoute}
          index={detail.index}
          mode={mode}
          from={from}
          to={to}
          trigger={detail.trigger}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
