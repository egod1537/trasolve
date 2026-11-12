import type { CSSProperties } from 'react';
import { TransitVehicleIcon } from './TransitVehicleIcon';
import type { MapRoute, TripPolylineMode } from '@trasolve/shared';
import { TravelMode } from '@trasolve/shared';
import { PolylineModeIcon } from '@/features/map-workspace/components/PolylineModeIcon';
import {
  buildRouteItinerary,
  buildRouteSummary,
} from '@/shared/lib/routePresentation';
import { useL } from '@/shared/i18n';

type RoutableMode = Exclude<TripPolylineMode, 'straight'>;

const TRAVEL_MODES: Record<RoutableMode, TravelMode> = {
  walking: TravelMode.WALKING,
  transit: TravelMode.TRANSIT,
  driving: TravelMode.DRIVING,
};

export function RouteDetails({
  route,
  mode,
  fromName,
  toName,
}: {
  route: MapRoute;
  mode: RoutableMode;
  fromName: string;
  toName: string;
}) {
  const L = useL();
  const summary = buildRouteSummary(route, TRAVEL_MODES[mode]);
  const itinerary = buildRouteItinerary(route, {
    origin: { type: 'address', address: fromName },
    destination: { type: 'address', address: toName },
    travelMode: TRAVEL_MODES[mode],
  });

  return (
    <section
      className="route-settings-details"
      aria-label={L('testbed:routeResultPanel.title.routeBySection')}
    >
      <dl className="route-settings-metrics">
        <div>
          <dt>
            {L('testbed:routeResultPanel.routeSummary.text.totalTimeRequired')}
          </dt>
          <dd>{summary.duration}</dd>
        </div>
        <div>
          <dt>
            {L('testbed:routeResultPanel.routeSummary.text.totalDistance')}
          </dt>
          <dd>{summary.distance}</dd>
        </div>
        {route.fare && (
          <div>
            <dt>
              {L('testbed:routeResultPanel.routeSummary.text.estimatedCost')}
            </dt>
            <dd>{summary.fare}</dd>
          </div>
        )}
      </dl>
      <h3>{L('testbed:routeResultPanel.title.routeBySection')}</h3>
      <p className="route-settings-endpoint">{fromName}</p>
      <ol className="route-settings-itinerary">
        {itinerary.flatMap((leg) =>
          leg.steps.map((step) => (
            <li
              key={step.key}
              data-transit={Boolean(step.transitColor)}
              style={
                step.transitColor
                  ? ({
                      '--route-segment-color': step.transitColor,
                    } as CSSProperties)
                  : undefined
              }
            >
              <span className="route-settings-step-mode">
                {step.transitColor ? (
                  <TransitVehicleIcon vehicleType={step.vehicleType} />
                ) : (
                  <PolylineModeIcon
                    mode={
                      step.travelMode === 'WALK' ||
                      step.travelMode === TravelMode.WALKING
                        ? 'walking'
                        : mode
                    }
                  />
                )}
                <span>{step.modeLabel}</span>
              </span>
              <div className="route-settings-step-content">
                <strong>{step.title}</strong>
                <p>{step.details.join(', ')}</p>
                {step.stopLabel && <p>{step.stopLabel}</p>}
                {step.headsign && <small>{step.headsign}</small>}
                {step.instruction && <small>{step.instruction}</small>}
              </div>
            </li>
          )),
        )}
      </ol>
      <p className="route-settings-endpoint">{toName}</p>
    </section>
  );
}
