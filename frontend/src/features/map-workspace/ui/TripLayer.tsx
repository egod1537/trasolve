import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type {
  Trip,
  TripDay,
  TripPolyline,
  TripPolylineMode,
} from '@trasolve/shared';
import type { MapObjectController } from '@/map/adapters/MapObjectController';
import type {
  MapMarkerHandle,
  MapMarkerIcon,
} from '@/shared/map/MapMarkerHandle';
import type { MapPolylineHandle } from '@/shared/map/MapPolylineHandle';
import type { GeoPoint } from '@/shared/types/mapTypes';
import { getPlaceStyleOption, resolvePlaceStyle } from '@/entities/place';
import { getTripPolylineStyle } from '@/entities/trip';

type Props = {
  objects: MapObjectController;
  trip: Trip;
  selectedPlaceId: string | null;
  selectedPolylineId: string | null;
  selectedDayId: string | null;
  visibleDayIds: ReadonlySet<string>;
  isZooming: boolean;
  onSelectPlace: (id: string) => void;
  onSelectPolyline: (id: string, anchor: GeoPoint) => void;
};

function getPolylinePath(
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

type OwnedPolyline = {
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

type PolylineState = {
  dayId: string;
  mode: TripPolylineMode;
  order: number;
  path: readonly GeoPoint[];
  selected: boolean;
  active: boolean;
  visible: boolean;
};

function isSamePath(
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

function getPolylineStyleKey(
  mode: TripPolylineMode,
  selected: boolean,
  active: boolean,
): string {
  return `${mode}:${selected}:${active}`;
}

function getPolylineZIndex(
  selected: boolean,
  active: boolean,
  order: number,
): number {
  return selected ? 10000 : active ? 5000 + order : order;
}

function syncPolylinePresentation(
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

function syncPolylineVisibility(line: OwnedPolyline, visible: boolean): void {
  if (line.visible === visible) {
    return;
  }
  line.handle.setVisible(visible);
  line.visible = visible;
}

function syncPolylineState(line: OwnedPolyline, next: PolylineState): void {
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

function getMarkerZIndex(selected: boolean, order: number): number {
  return selected ? 10_000 : order;
}

type OwnedMarker = {
  handle: MapMarkerHandle;
  unsubscribe: () => void;
  dayId: string;
  order: number;
  position: GeoPoint;
  title: string;
  color: string;
  icon: MapMarkerIcon | undefined;
  selected: boolean;
  visible: boolean;
  zIndex: number;
};

type MarkerState = Omit<OwnedMarker, 'handle' | 'unsubscribe'>;

type TripLayerModel = {
  markers: Array<{
    id: string;
    dayId: string;
    order: number;
    position: GeoPoint;
    title: string;
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

function toTripLayerModel(trip: Trip): TripLayerModel {
  const markers: TripLayerModel['markers'] = [];
  const polylines: TripLayerModel['polylines'] = [];
  for (const day of trip.days) {
    const layerOrder = new Map(
      day.layerItems.map(
        (item, index) => [`${item.type}:${item.id}`, index + 1] as const,
      ),
    );
    for (const place of day.places) {
      const placeStyle = resolvePlaceStyle(place.placeStyle, day.color);
      markers.push({
        id: place.id,
        dayId: day.id,
        order: layerOrder.get(`place:${place.id}`) ?? place.order,
        position: place.location,
        title: `${day.title} · ${place.order}. ${place.name}`,
        color: placeStyle.color,
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

function syncMarkerState(marker: OwnedMarker, next: MarkerState): void {
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

function syncMarkerVisibility(marker: OwnedMarker, visible: boolean): void {
  if (marker.visible === visible) {
    return;
  }
  marker.handle.setVisible(visible);
  marker.visible = visible;
}

function getMarkerVisibility(
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

function getPolylineVisibility(
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

/** Projects Trip data to provider-neutral map objects; owns no domain mutations. */
export const TripLayer = memo(function TripLayer({
  objects,
  trip,
  selectedPlaceId,
  selectedPolylineId,
  selectedDayId,
  visibleDayIds,
  isZooming,
  onSelectPlace,
  onSelectPolyline,
}: Props) {
  const markers = useRef(new Map<string, OwnedMarker>());
  const lines = useRef(new Map<string, OwnedPolyline>());
  const placeSelection = useRef(onSelectPlace);
  const polylineSelection = useRef(onSelectPolyline);
  useLayoutEffect(() => {
    placeSelection.current = onSelectPlace;
    polylineSelection.current = onSelectPolyline;
  }, [onSelectPlace, onSelectPolyline]);
  const tripId = trip.id;
  const layerModel = useMemo(() => toTripLayerModel(trip), [trip]);
  const selectedPlaceIdRef = useRef(selectedPlaceId);
  const selectedPolylineIdRef = useRef(selectedPolylineId);
  const selectedDayIdRef = useRef(selectedDayId);
  const visibleDayIdsRef = useRef(visibleDayIds);
  const isZoomingRef = useRef(isZooming);
  useLayoutEffect(() => {
    selectedPlaceIdRef.current = selectedPlaceId;
    selectedPolylineIdRef.current = selectedPolylineId;
    selectedDayIdRef.current = selectedDayId;
    visibleDayIdsRef.current = visibleDayIds;
    isZoomingRef.current = isZooming;
  }, [
    isZooming,
    selectedDayId,
    selectedPlaceId,
    selectedPolylineId,
    visibleDayIds,
  ]);

  useEffect(() => {
    const ownedMarkers = markers.current,
      ownedLines = lines.current;
    return () => {
      for (const { handle, unsubscribe } of ownedMarkers.values()) {
        unsubscribe();
        handle.remove();
      }
      for (const { handle, unsubscribe } of ownedLines.values()) {
        unsubscribe();
        handle.remove();
      }
      ownedMarkers.clear();
      ownedLines.clear();
    };
  }, [objects, tripId]);

  useEffect(() => {
    const remaining = new Set<string>();
    for (const place of layerModel.markers) {
      const selected = selectedPlaceIdRef.current === place.id;
      const visible = getMarkerVisibility(
        place.dayId,
        place.id,
        visibleDayIdsRef.current,
        selectedPlaceIdRef.current,
        isZoomingRef.current,
      );
      const zIndex = getMarkerZIndex(selected, place.order);
      remaining.add(place.id);
      let marker = markers.current.get(place.id);
      if (!marker) {
        const handle = objects.addMarker({
          id: `${tripId}:place:${place.id}`,
          layer: 'itinerary-markers',
          position: place.position,
          title: place.title,
          color: place.color,
          icon: place.icon,
          selected,
          visible,
          zIndex,
        });
        const unsubscribeClick = handle.onClick(() =>
          placeSelection.current(place.id),
        );
        marker = {
          handle,
          unsubscribe: () => {
            unsubscribeClick();
          },
          dayId: place.dayId,
          order: place.order,
          position: place.position,
          title: place.title,
          color: place.color,
          icon: place.icon,
          selected,
          visible,
          zIndex,
        };
        markers.current.set(place.id, marker);
        continue;
      }
      syncMarkerState(marker, {
        dayId: place.dayId,
        order: place.order,
        position: place.position,
        title: place.title,
        color: place.color,
        icon: place.icon,
        selected,
        visible,
        zIndex,
      });
    }
    for (const [id, marker] of markers.current) {
      if (!remaining.has(id)) {
        marker.unsubscribe();
        marker.handle.remove();
        markers.current.delete(id);
      }
    }
    const remainingPolylines = new Set<string>();
    for (const polyline of layerModel.polylines) {
      remainingPolylines.add(polyline.id);
      const selected = selectedPolylineIdRef.current === polyline.id;
      const active = selectedDayIdRef.current === polyline.dayId;
      const visible = getPolylineVisibility(
        polyline.dayId,
        polyline.id,
        polyline.path.length,
        visibleDayIdsRef.current,
        selectedPolylineIdRef.current,
        isZoomingRef.current,
      );
      let line = lines.current.get(polyline.id);
      if (!line) {
        const styleKey = getPolylineStyleKey(polyline.mode, selected, active);
        const zIndex = getPolylineZIndex(selected, active, polyline.order);
        const handle = objects.addPolyline({
          id: `${tripId}:polyline:${polyline.id}`,
          layer: 'itinerary-polylines',
          path: polyline.path,
          style: getTripPolylineStyle(polyline.mode, selected, active),
          visible,
          zIndex,
        });
        line = {
          handle,
          unsubscribe: handle.onClick((anchor) =>
            polylineSelection.current(polyline.id, anchor),
          ),
          dayId: polyline.dayId,
          mode: polyline.mode,
          order: polyline.order,
          path: polyline.path,
          styleKey,
          visible,
          zIndex,
        };
        lines.current.set(polyline.id, line);
      }
      syncPolylineState(line, {
        dayId: polyline.dayId,
        mode: polyline.mode,
        order: polyline.order,
        path: polyline.path,
        selected,
        active,
        visible,
      });
    }
    for (const [id, line] of lines.current) {
      if (!remainingPolylines.has(id)) {
        line.unsubscribe();
        line.handle.remove();
        lines.current.delete(id);
      }
    }
  }, [layerModel, objects, tripId]);

  const previousSelectedPlaceId = useRef<string | null>(null);
  useEffect(() => {
    const previousId = previousSelectedPlaceId.current;
    if (previousId && previousId !== selectedPlaceId) {
      const previous = markers.current.get(previousId);
      if (previous) {
        previous.handle.setSelected(false);
        previous.handle.setZIndex(previous.order);
        previous.selected = false;
        previous.zIndex = previous.order;
      }
    }
    if (selectedPlaceId) {
      const selected = markers.current.get(selectedPlaceId);
      if (selected) {
        selected.handle.setSelected(true);
        selected.handle.setZIndex(10_000);
        selected.selected = true;
        selected.zIndex = 10_000;
      }
    }
    previousSelectedPlaceId.current = selectedPlaceId;
  }, [selectedPlaceId]);

  useEffect(() => {
    for (const [id, line] of lines.current) {
      const selected = selectedPolylineId === id;
      const active = selectedDayId === line.dayId;
      syncPolylinePresentation(line, selected, active);
    }
  }, [selectedDayId, selectedPolylineId]);

  useEffect(() => {
    for (const [placeId, marker] of markers.current) {
      const visible = getMarkerVisibility(
        marker.dayId,
        placeId,
        visibleDayIds,
        selectedPlaceId,
        isZooming,
      );
      syncMarkerVisibility(marker, visible);
    }
    for (const [polylineId, line] of lines.current) {
      syncPolylineVisibility(
        line,
        getPolylineVisibility(
          line.dayId,
          polylineId,
          line.path.length,
          visibleDayIds,
          selectedPolylineId,
          isZooming,
        ),
      );
    }
  }, [isZooming, selectedPlaceId, selectedPolylineId, visibleDayIds]);

  return null;
});
