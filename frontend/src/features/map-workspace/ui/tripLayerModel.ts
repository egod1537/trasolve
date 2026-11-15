import type {
  Trip,
  TripDay,
  TripPolyline,
  TripPolylineMode,
} from '@trasolve/shared';
import type {
  MapMarkerHandle,
  MapMarkerIcon,
  MapMarkerRouteRole,
} from '@/shared/map/MapMarkerHandle';
import { getRouteMarkerRole } from '@/shared/map/routeMarkerRole';
import type { MapPolylineHandle } from '@/shared/map/MapPolylineHandle';
import type { GeoPoint } from '@/shared/types/mapTypes';
import {
  formatPlaceVisitTime,
  getPlaceStyleOption,
  resolvePlaceStyle,
} from '@/entities/place';
import { getTripPolylineStyle } from '@/entities/trip';
import { L } from '@/shared/i18n';

export function getPolylinePath(
  day: TripDay,
  polyline: TripPolyline,
): Array<{ lat: number; lng: number }> {
  if (polyline.path) {
    return polyline.path.map((point) => ({ ...point }));
  }
  const from = day.places.find((place) => place.id === polyline.fromPlaceId);
  const to = day.places.find((place) => place.id === polyline.toPlaceId);
  return from && to ? [{ ...from.location }, { ...to.location }] : [];
}

export type OwnedPolyline = {
  handle: MapPolylineHandle;
  unsubscribe: () => void;
  dayId: string;
  mode: TripPolylineMode;
  order: number;
  path: readonly GeoPoint[];
  styleKey: string;
  visible: boolean;
  zIndex: number;
};

export type PolylineState = {
  dayId: string;
  mode: TripPolylineMode;
  order: number;
  path: readonly GeoPoint[];
  selected: boolean;
  active: boolean;
  visible: boolean;
};

export function isSamePath(
  current: readonly GeoPoint[],
  next: readonly GeoPoint[],
): boolean {
  return (
    current.length === next.length &&
    current.every(
      (point, index) =>
        point.lat === next[index]!.lat && point.lng === next[index]!.lng,
    )
  );
}

export function getPolylineStyleKey(
  mode: TripPolylineMode,
  selected: boolean,
  active: boolean,
): string {
  return `${mode}:${selected}:${active}`;
}

export function getPolylineZIndex(
  selected: boolean,
  active: boolean,
  order: number,
): number {
  return selected ? 10000 : active ? 5000 + order : order;
}

export function syncPolylinePresentation(
  line: OwnedPolyline,
  selected: boolean,
  active: boolean,
): void {
  const styleKey = getPolylineStyleKey(line.mode, selected, active);
  if (line.styleKey !== styleKey) {
    line.handle.setStyle(getTripPolylineStyle(line.mode, selected, active));
    line.styleKey = styleKey;
  }

  const zIndex = getPolylineZIndex(selected, active, line.order);
  if (line.zIndex !== zIndex) {
    line.handle.setZIndex(zIndex);
    line.zIndex = zIndex;
  }
}

export function syncPolylineVisibility(
  line: OwnedPolyline,
  visible: boolean,
): void {
  if (line.visible === visible) {
    return;
  }
  line.handle.setVisible(visible);
  line.visible = visible;
}

export function syncPolylineState(
  line: OwnedPolyline,
  next: PolylineState,
): void {
  if (!isSamePath(line.path, next.path)) {
    line.handle.setPath(next.path);
    line.path = next.path;
  }

  line.dayId = next.dayId;
  line.mode = next.mode;
  line.order = next.order;
  syncPolylinePresentation(line, next.selected, next.active);
  syncPolylineVisibility(line, next.visible);
}

export function getMarkerZIndex(selected: boolean, order: number): number {
  return selected ? 10_000 : order;
}

export type OwnedMarker = {
  handle: MapMarkerHandle;
  unsubscribe: () => void;
  dayId: string;
  order: number;
  position: GeoPoint;
  title: string;
  visitTime: string | undefined;
  routeRole: MapMarkerRouteRole | undefined;
  color: string;
  icon: MapMarkerIcon | undefined;
  selected: boolean;
  visible: boolean;
  zIndex: number;
};

export type MarkerState = Omit<OwnedMarker, 'handle' | 'unsubscribe'>;

export type TripLayerModel = {
  markers: Array<{
    id: string;
    dayId: string;
    order: number;
    position: GeoPoint;
    title: string;
    visitTime: string | undefined;
    routeRole: MapMarkerRouteRole | undefined;
    color: string;
    icon: MapMarkerIcon;
  }>;
  polylines: Array<{
    id: string;
    dayId: string;
    mode: TripPolylineMode;
    order: number;
    path: readonly GeoPoint[];
  }>;
};

export function toTripLayerModel(trip: Trip): TripLayerModel {
  const markers: TripLayerModel['markers'] = [];
  const polylines: TripLayerModel['polylines'] = [];
  for (const day of trip.days) {
    const orderedPlaces = [...day.places].sort((a, b) => a.order - b.order);
    const routeRoles = new Map(
      orderedPlaces.map((place, index) => [
        place.id,
        getRouteMarkerRole(index, orderedPlaces.length),
      ]),
    );
    const layerOrder = new Map(
      day.layerItems.map(
        (item, index) => [`${item.type}:${item.id}`, index + 1] as const,
      ),
    );
    for (const place of day.places) {
      const placeStyle = resolvePlaceStyle(place.placeStyle, day.color);
      const routeRole = routeRoles.get(place.id);
      markers.push({
        id: place.id,
        dayId: day.id,
        order: layerOrder.get(`place:${place.id}`) ?? place.order,
        position: place.location,
        title: L('map:tripLayer.toTripLayerModel.title.message', {
          title: day.title,
          order: place.order,
          name: place.name,
        }),
        visitTime: formatPlaceVisitTime(place),
        routeRole,
        color: routeRole ? day.color : placeStyle.color,
        icon: getPlaceStyleOption(placeStyle.type).icon,
      });
    }
    for (const polyline of day.polylines) {
      polylines.push({
        id: polyline.id,
        dayId: day.id,
        mode: polyline.mode,
        order: layerOrder.get(`polyline:${polyline.id}`) ?? polyline.order,
        path: getPolylinePath(day, polyline),
      });
    }
  }
  return { markers, polylines };
}

export function syncMarkerState(marker: OwnedMarker, next: MarkerState): void {
  if (
    marker.position.lat !== next.position.lat ||
    marker.position.lng !== next.position.lng
  ) {
    marker.handle.setPosition(next.position);
    marker.position = next.position;
  }
  if (marker.title !== next.title) {
    marker.handle.setTitle(next.title);
    marker.title = next.title;
  }
  if (marker.visitTime !== next.visitTime) {
    marker.handle.setCallout(
      next.visitTime
        ? { text: next.visitTime, visibility: 'hover' }
        : undefined,
    );
    marker.visitTime = next.visitTime;
  }
  if (marker.routeRole !== next.routeRole) {
    marker.handle.setRouteRole(next.routeRole);
    marker.routeRole = next.routeRole;
  }
  if (marker.color !== next.color) {
    marker.handle.setColor(next.color);
    marker.color = next.color;
  }
  if (marker.icon !== next.icon) {
    marker.handle.setIcon(next.icon);
    marker.icon = next.icon;
  }
  if (marker.selected !== next.selected) {
    marker.handle.setSelected(next.selected);
    marker.selected = next.selected;
  }
  if (marker.visible !== next.visible) {
    marker.handle.setVisible(next.visible);
    marker.visible = next.visible;
  }
  if (marker.zIndex !== next.zIndex) {
    marker.handle.setZIndex(next.zIndex);
    marker.zIndex = next.zIndex;
  }
  marker.dayId = next.dayId;
  marker.order = next.order;
}

export function syncMarkerVisibility(
  marker: OwnedMarker,
  visible: boolean,
): void {
  if (marker.visible === visible) {
    return;
  }
  marker.handle.setVisible(visible);
  marker.visible = visible;
}

export function getMarkerVisibility(
  dayId: string,
  placeId: string,
  visibleDayIds: ReadonlySet<string>,
  selectedPlaceId: string | null,
  isZooming: boolean,
): boolean {
  return (
    visibleDayIds.has(dayId) && (!isZooming || selectedPlaceId === placeId)
  );
}

export function getPolylineVisibility(
  dayId: string,
  polylineId: string,
  pathLength: number,
  visibleDayIds: ReadonlySet<string>,
  selectedPolylineId: string | null,
  isZooming: boolean,
): boolean {
  return (
    visibleDayIds.has(dayId) &&
    pathLength > 1 &&
    (!isZooming || selectedPolylineId === polylineId)
  );
}
