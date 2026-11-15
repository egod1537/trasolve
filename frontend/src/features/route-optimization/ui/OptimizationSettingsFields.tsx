import type { TripDay } from '@trasolve/shared';
import type { RouteOptimizationRequestOptions } from '../model/routeOptimization';
import { TRAVEL_MODE_OPTIONS } from './optimizationSettings';
import { OptimizationDepartureOptions } from './OptimizationDepartureOptions';
import { TravelModeIcon } from '@/shared/ui/TravelModeIcon';
import { useL } from '@/shared/i18n';

export function OptimizationSettingsFields({
  day,
  settings,
  disabled,
  onChange,
}: {
  day: TripDay;
  settings: RouteOptimizationRequestOptions;
  disabled: boolean;
  onChange: (patch: Partial<RouteOptimizationRequestOptions>) => void;
}) {
  const L = useL();
  return (
    <>
      <fieldset className="route-settings-section" disabled={disabled}>
        <legend>
          {L(
            'routeOptimization:routeOptimizationModal.optimizationSettings.text.meansTransportation',
          )}
        </legend>
        <div className="route-settings-icon-options route-settings-travel-options">
          {TRAVEL_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={settings.travelMode === option.value}
              onClick={() => onChange({ travelMode: option.value })}
            >
              <TravelModeIcon mode={option.value} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="route-settings-section" disabled={disabled}>
        <legend>
          {L(
            'routeOptimization:routeOptimizationModal.optimizationSettings.text.startTime',
          )}
        </legend>
        <OptimizationDepartureOptions
          key={day.id}
          settings={settings}
          initialTime={
            [...day.places].sort((a, b) => a.order - b.order)[0]?.time ??
            '09:00'
          }
          onChange={onChange}
        />
      </fieldset>
    </>
  );
}
