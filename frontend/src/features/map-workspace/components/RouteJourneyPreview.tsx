import type { CSSProperties } from 'react';
import type { MapRoute } from '@trasolve/shared';
import {
  formatDuration,
  getTravelModeLabel,
} from '@/shared/lib/routePresentation';
import { useL } from '@/shared/i18n';
import { getTransitStyle } from '@/shared/lib/transitPresentation';
import { PolylineModeIcon } from './PolylineModeIcon';
import { TransitVehicleIcon } from './TransitVehicleIcon';

// The proportional journey bar describes transit rides, transfers and walks.
// Walking/driving result cards render their own mode-specific summaries.
export function RouteJourneyPreview({ route }: { route: MapRoute }) {
  const L = useL();
  const steps = route.legs.flatMap((leg) => leg.steps);
  const timed = steps.every((step) => step.durationMillis !== null);
  const total = steps.reduce(
    (sum, step) => sum + (step.durationMillis ?? 0),
    0,
  );
  const transit = steps.filter((step) => step.transitDetails);
  const instructions = steps.filter((step) => step.instruction).slice(0, 3);
  return (
    <>
      {timed && total > 0 && (
        <div
          className="route-journey-bar"
          role="img"
          aria-label={L('testbed:routeResultPanel.title.routeBySection')}
        >
          {steps.map((step, index) => {
            const walking =
              step.travelMode === 'WALK' || step.travelMode === 'WALKING';
            const label = getTravelModeLabel(
              step.travelMode,
              step.transitDetails?.vehicleType,
            );
            const style = getTransitStyle(step);
            return (
              <span
                key={index}
                className={walking ? 'is-walking' : 'is-riding'}
                style={
                  {
                    flexGrow: step.durationMillis ?? 0,
                    '--route-segment-color': style.color,
                    '--route-segment-text-color': style.textColor,
                  } as CSSProperties
                }
                title={[label, formatDuration(step.durationMillis)].join(', ')}
              >
                {walking ? (
                  <PolylineModeIcon mode="walking" />
                ) : (
                  <TransitVehicleIcon
                    vehicleType={step.transitDetails?.vehicleType}
                  />
                )}
                <span>{formatDuration(step.durationMillis)}</span>
              </span>
            );
          })}
        </div>
      )}
      {transit.length ? (
        <ol className="route-journey-transit">
          {transit.map((step, index) => {
            const details = step.transitDetails!;
            return (
              <li
                key={index}
                style={
                  {
                    '--route-segment-color': getTransitStyle(step).color,
                  } as CSSProperties
                }
              >
                <strong className="route-journey-line">
                  <TransitVehicleIcon vehicleType={details.vehicleType} />
                  <span className="route-journey-line-label">
                    {details.busTypeName && (
                      <small>{details.busTypeName}</small>
                    )}
                    <span>
                      {details.lineShortName ||
                        details.lineName ||
                        getTravelModeLabel(
                          step.travelMode,
                          details.vehicleType,
                        )}
                    </span>
                  </span>
                </strong>
                <span>
                  {[details.departureStop, details.arrivalStop]
                    .filter(Boolean)
                    .join(' → ')}
                </span>
              </li>
            );
          })}
        </ol>
      ) : instructions.length ? (
        <p className="route-journey-instructions">
          {instructions.map((step) => step.instruction).join(' → ')}
        </p>
      ) : null}
    </>
  );
}
