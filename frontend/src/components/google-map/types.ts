import type { CSSProperties, ReactNode, Ref } from 'react';
import type {
  GeoBounds,
  GeoPoint,
  MapPadding,
  ScreenPoint,
} from '../../domain/map/mapTypes';

export type LatLng = GeoPoint;
export type MapBounds = GeoBounds;

export type MapPlace = {
  id?: string;
  name: string;
  address?: string;
  location: LatLng;
};

export type GoogleMapOptions = {
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

export type GoogleMapHandle = {
  panTo(position: LatLng, offset?: ScreenPoint): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: MapBounds, padding?: MapPadding): void;
};

export type GoogleMapEvents = {
  onMapClick?: (position: LatLng) => void;
  onCenterChanged?: (position: LatLng) => void;
  onZoomChanged?: (zoom: number) => void;
};

export type MapPolyline = {
  path: readonly LatLng[];
  color?: string;
  weight?: number;
  opacity?: number;
};

export type GoogleMapStatus = 'loading' | 'ready' | 'missing-key' | 'error';

export type GoogleMapProps = GoogleMapEvents & {
  ref?: Ref<GoogleMapHandle>;
  center?: LatLng;
  zoom?: number;
  mapId?: string;
  options?: GoogleMapOptions;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  polylines?: readonly MapPolyline[];
  onReady?: (map: GoogleMapHandle) => void;
  onError?: (error: Error) => void;
  renderStatus?: (status: Exclude<GoogleMapStatus, 'ready'>) => ReactNode;
  children?: ReactNode;
};
