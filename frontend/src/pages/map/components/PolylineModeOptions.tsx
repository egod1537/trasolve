import type { TripPolylineMode } from '@trasolve/shared';
import { POLYLINE_MODE_OPTIONS } from '../domain/polylineMode';
import { PolylineModeIcon } from './PolylineModeIcon';

type Props = {
  mode: TripPolylineMode | null;
  busy: boolean;
  showLabels?: boolean;
  onSelect: (mode: TripPolylineMode) => void;
};

export function PolylineModeOptions({
  mode,
  busy,
  showLabels = false,
  onSelect,
}: Props) {
  return (
    <div className={`polyline-mode-options${showLabels ? ' is-labeled' : ''}`}>
      {POLYLINE_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          aria-pressed={mode === option.value}
          title={option.label}
          disabled={busy}
          onClick={() => onSelect(option.value)}
        >
          <PolylineModeIcon mode={option.value} />
          {showLabels && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  );
}
