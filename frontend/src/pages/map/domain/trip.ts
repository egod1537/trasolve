import type { GeoPoint } from '../../../map/types/mapTypes';
import type {
  PlaceOpeningHours,
  PlaceStyle,
  TripLayerItem as SharedTripLayerItem,
  TripPolylineMode,
} from '@trasolve/shared';

export type Coordinates = GeoPoint;

export type TripPlace = Coordinates & {
  id: string;
  placeId?: string;
  name: string;
  address?: string;
  location?: Coordinates;
  memo?: string;
  description: string;
  openingHours?: PlaceOpeningHours;
  placeStyle?: PlaceStyle;
  durationMinutes?: number;
  time?: string;
  order: number;
};

export type TripPolyline = {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  path?: Coordinates[];
  mode: TripPolylineMode;
  color?: string;
  order: number;
};

export type LayerItem = SharedTripLayerItem;

export type LayerValidationIssue = {
  level: 'warning' | 'error';
  code?: string;
  message: string;
};

export type LayerValidationState = {
  issues: readonly LayerValidationIssue[];
};

export type LayerValidationByItemKey = Readonly<
  Partial<Record<string, LayerValidationState>>
>;

export type TripDay = {
  id: string;
  title: string;
  date?: string;
  color: string;
  places: TripPlace[];
  polylines: TripPolyline[];
  layerItems: LayerItem[];
};

export type Trip = {
  title: string;
  period: string;
  days: TripDay[];
};
