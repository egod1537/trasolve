import { useState } from 'react';
import type { RouteOptimizationRequestOptions } from '@/features/route-optimization/model/routeOptimization';
import { START_POLICY_OPTIONS } from '@/features/route-optimization/ui/optimizationSettings';
import { DepartureIcon } from '@/shared/ui/TravelModeIcon';
import { useL } from '@/shared/i18n';

export function OptimizationDepartureOptions({
  settings,
  initialTime,
  onChange,
}: {
  settings: RouteOptimizationRequestOptions;
  initialTime: string;
  onChange: (patch: Partial<RouteOptimizationRequestOptions>) => void;
}) {
  const L = useL();
  const [draftTime, setDraftTime] = useState(settings.startTime ?? initialTime);
  const fixedOption = START_POLICY_OPTIONS.find(
    (option) => option.value === 'fixed',
  )!;
  const fixed = settings.startPolicy === 'fixed';
  return (
    <div className="route-settings-departure-options">
      <div className="route-settings-fixed-option" data-selected={fixed}>
        <button
          type="button"
          aria-pressed={fixed}
          onClick={() =>
            onChange({ startPolicy: 'fixed', startTime: draftTime })
          }
        >
          <DepartureIcon policy="fixed" />
          <span>{fixedOption.label}</span>
        </button>
        <input
          className="ui-field"
          type="time"
          step={600}
          value={fixed ? (settings.startTime ?? draftTime) : draftTime}
          disabled={!fixed}
          aria-label={L(
            'routeOptimization:routeOptimizationModal.optimizationSettings.ariaLabel.fixedStartTime',
          )}
          onChange={(event) => {
            setDraftTime(event.target.value);
            onChange({ startTime: event.target.value || null });
          }}
        />
      </div>
      <div className="route-settings-icon-options route-settings-start-options">
        {START_POLICY_OPTIONS.filter((option) => option.value !== 'fixed').map(
          (option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={settings.startPolicy === option.value}
              onClick={() =>
                onChange({ startPolicy: option.value, startTime: null })
              }
            >
              <DepartureIcon policy={option.value} />
              <span>{option.label}</span>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
