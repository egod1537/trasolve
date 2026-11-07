import type { GeoBounds, GeoPoint } from '@/shared/types/mapTypes';

export type MapFocus = { revision: number } & (
  | { type: 'all' }
  | { type: 'day'; dayId: string }
  | { type: 'place'; placeId: string }
);

export type MapFocusTarget =
  | {
      type: 'bounds';
      revision: number;
      bounds: GeoBounds | null;
    }
  | {
      type: 'point';
      revision: number;
      point: GeoPoint | null;
    };
