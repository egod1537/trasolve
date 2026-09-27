import type { TripPolylineMode } from '@trasolve/shared';
import { POLYLINE_MODES } from '@/features/map-workspace/domain/polylineMode';
import { formatPolylineMode } from '@/features/map-workspace/lib/mapFormatters';
import { PolylineModeIcon } from '@/features/map-workspace/components/PolylineModeIcon';
import { useL } from '@/shared/i18n';

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
  const L = useL();
  return (
    <div className={`polyline-mode-options${showLabels ? ' is-labeled' : ''}`}>
      {POLYLINE_MODES.map((option) => (
        <button
          key={option}
          type="button"
          aria-label={formatPolylineMode(option, L)}
          aria-pressed={mode === option}
          title={formatPolylineMode(option, L)}
          disabled={busy}
          onClick={() => onSelect(option)}
        >
          <PolylineModeIcon mode={option} />
          {showLabels && <span>{formatPolylineMode(option, L)}</span>}
        </button>
      ))}
    </div>
  );
}
