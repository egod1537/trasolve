import type { Trip } from '@trasolve/shared';
import type { SelectedTripPlace, SelectedTripPolyline } from '@/entities/trip';
import type { GeoPoint, MapClickEvent } from '@/shared/types/mapTypes';
import type { MapFocusTarget } from '../domain/mapUiTypes';

export type TripMapView = {
  trip: Trip;
  focusTarget: MapFocusTarget;
  selectedPlaceId: string | null;
  selectedPolylineId: string | null;
  selectedDayId: string | null;
  visibleDayIds: ReadonlySet<string>;
};
export type MapSelectionActions = {
  onSelectPlace: (id: string) => void;
  onFocusPlace: (id: string) => void;
  onSelectPolyline: (id: string, anchor: GeoPoint) => void;
  onMapClick: (event: MapClickEvent) => void;
};
export type MapDetailSelection = {
  selectionRevision: number;
  selectedTripPlace: SelectedTripPlace | null;
  selectedTripPolyline: SelectedTripPolyline | null;
};
