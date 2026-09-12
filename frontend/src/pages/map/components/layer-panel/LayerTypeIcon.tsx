import type { TripPolylineMode } from '@trasolve/shared';
import { PolylineModeIcon } from '../PolylineModeIcon';

type Props =
  | { type: 'place'; mode?: never }
  | { type: 'polyline'; mode: TripPolylineMode };

export function LayerTypeIcon({ type, mode }: Props) {
  return (
    <span
      className={`trip-layer-type-icon is-${type}${mode ? ` is-${mode}` : ''}`}
      aria-hidden="true"
    >
      {type === 'place' ? (
        <svg viewBox="0 0 24 24">
          <>
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </>
        </svg>
      ) : (
        <PolylineModeIcon mode={mode} />
      )}
    </span>
  );
}
