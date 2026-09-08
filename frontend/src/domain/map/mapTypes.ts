export type GeoPoint = {
  lat: number;
  lng: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export type GeoBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MapPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type MapCameraState = {
  center: GeoPoint;
  zoom: number;
};

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
