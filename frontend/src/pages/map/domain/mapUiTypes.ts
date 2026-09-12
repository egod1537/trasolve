import type { GeoBounds } from '../../../map/types/mapTypes';

export type MapFocus = { revision: number } & (
  { type: 'all' } | { type: 'day'; dayId: string }
);

export type MapFocusTarget = {
  type: 'bounds';
  revision: number;
  bounds: GeoBounds | null;
};
