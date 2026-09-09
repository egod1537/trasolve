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

export type LatLng = GeoPoint;
export type MapBounds = GeoBounds;

export type MapClickEvent = LatLng & {
  /** Present when the provider supplies a place ID for a clicked POI. */
  placeId?: string;
};

export type MapPlace = {
  id?: string;
  name: string;
  address?: string;
  location: LatLng;
};

export type MapOptions = {
  gestureHandling?: 'auto' | 'cooperative' | 'greedy' | 'none';
  clickableIcons?: boolean;
  disableDefaultUI?: boolean;
  zoomControl?: boolean;
  scrollwheel?: boolean;
  disableDoubleClickZoom?: boolean;
  keyboardShortcuts?: boolean;
  streetViewControl?: boolean;
  mapTypeControl?: boolean;
  fullscreenControl?: boolean;
  minZoom?: number | null;
  maxZoom?: number | null;
  mapTypeId?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
};

export type MapHandle = {
  panTo(position: LatLng, offset?: ScreenPoint): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: MapBounds, padding?: MapPadding): void;
};

export type MapEvents = {
  onMapClick?: (event: MapClickEvent) => void;
  onCenterChanged?: (position: LatLng) => void;
  onZoomChanged?: (zoom: number) => void;
};

export type MapPolyline = {
  path: readonly LatLng[];
  color?: string;
  weight?: number;
  opacity?: number;
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
