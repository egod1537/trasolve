import type { GeoPoint, GeoBounds } from '../../../map/types/mapTypes';

export type MapFocus = { revision: number } & (
  | { type: 'all' }
  | { type: 'day'; dayId: string }
  | { type: 'place'; placeId: string }
);

export type MapFocusTarget =
  | {
      type: 'place';
      revision: number;
      point: GeoPoint;
    }
  | {
      type: 'bounds';
      revision: number;
      bounds: GeoBounds | null;
    };
