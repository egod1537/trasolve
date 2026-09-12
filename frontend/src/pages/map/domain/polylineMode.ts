import type { TripPolylineMode } from '@trasolve/shared';

export const POLYLINE_MODE_OPTIONS: ReadonlyArray<{
  value: TripPolylineMode;
  label: string;
}> = [
  { value: 'straight', label: '직선' },
  { value: 'walking', label: '도보' },
  { value: 'transit', label: '대중교통' },
  { value: 'driving', label: '자동차' },
];

export function formatPolylineMode(mode: TripPolylineMode): string {
  return (
    POLYLINE_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode
  );
}
