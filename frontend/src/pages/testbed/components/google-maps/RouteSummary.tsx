import type { MapRoute } from '@trasolve/shared';
import {
  type ItineraryEndpointModel,
  type ItineraryStepModel,
  type RouteSummaryModel,
} from '@/pages/testbed/components/google-maps/routeResultModel';
import { useL } from '@/shared/i18n';

export function RouteSummary({
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

export function ItineraryEndpoint({
  endpoint,
}: {
  endpoint: ItineraryEndpointModel;
}) {
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

export function ItineraryStep({ step }: { step: ItineraryStepModel }) {
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

export function getRouteKey(route: MapRoute): string {
  return [
    route.description,
    route.durationMillis,
    route.distanceMeters,
    ...route.path.flatMap((point) => [point.lat, point.lng]),
  ].join(':');
}
