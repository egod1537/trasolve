import { useState } from 'react';
import type { MapRoute } from '@trasolve/shared';
import type { RouteEndpoint, RoutableMode } from '../domain/routeDetails';
import { TRAVEL_MODES } from '../model/useRouteOptions';
import { buildRouteSummary } from '@/shared/lib/routePresentation';
import { useL } from '@/shared/i18n';
import { RouteDetails } from './RouteDetails';
import { RouteJourneyPreview } from './RouteJourneyPreview';

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
  return (
    <div
      className="route-results"
      aria-label={L('testbed:routeResultPanel.ariaLabel.directionsResults')}
    >
      {routes.map((route, index) => {
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
              onClick={() => setSelected(index)}
            >
              <span className="route-result-label">
                {L('testbed:routeResultPanel.text.path', { value: index + 1 })}
              </span>
              <span className="route-result-facts">
                <strong>{summary.duration}</strong>
                <span>{summary.distance}</span>
                {route.fare && <span>{summary.fare}</span>}
              </span>
            </button>
            <RouteJourneyPreview route={route} mode={mode} />
            <details className="route-result-expanded">
              <summary>
                {L('testbed:routeResultPanel.title.routeBySection')}
              </summary>
              <RouteDetails
                route={route}
                mode={mode}
                fromName={from.name}
                toName={to.name}
              />
            </details>
          </article>
        );
      })}
    </div>
  );
}
