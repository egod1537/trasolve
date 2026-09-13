import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import type {
  Trip,
  TripDay,
  TripPolyline,
  TripPolylineMode,
} from '@trasolve/shared';
import type {
  MapMarkerHandle,
  MapObjectController,
  MapPolylineHandle,
  MapPolylineStyle,
} from '../../../../map/adapters/MapObjectController';
import type { GeoPoint } from '../../../../map/types/mapTypes';
import {
  getPlaceStyleOption,
  resolvePlaceStyle,
} from '../../domain/placeStyle';

type Props = {
  objects: MapObjectController;
  trip: Trip;
  selectedPlaceId: string | null;
  selectedPolylineId: string | null;
  selectedDayId: string | null;
  visibleDayIds: ReadonlySet<string>;
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

const POLYLINE_MODE_STYLES: Record<
  TripPolylineMode,
  Required<
    Pick<
      MapPolylineStyle,
      | 'color'
      | 'width'
      | 'pattern'
      | 'patternRepeatPx'
      | 'directionRepeatPx'
      | 'directionScale'
    >
  >
> = {
  straight: {
    color: '#2563eb',
    width: 4,
    pattern: 'solid',
    patternRepeatPx: 20,
    directionRepeatPx: 88,
    directionScale: 3.6,
  },
  walking: {
    color: '#059669',
    width: 3.5,
    pattern: 'short-dash',
    patternRepeatPx: 17,
    directionRepeatPx: 76,
    directionScale: 3.4,
  },
  transit: {
    color: '#7c3aed',
    width: 4.5,
    pattern: 'stations',
    patternRepeatPx: 34,
    directionRepeatPx: 102,
    directionScale: 3.7,
  },
  driving: {
    color: '#ea580c',
    width: 6,
    pattern: 'solid',
    patternRepeatPx: 20,
    directionRepeatPx: 92,
    directionScale: 4.2,
  },
};

function getPolylineStyle(
  mode: TripPolylineMode,
  selected: boolean,
  active: boolean,
): MapPolylineStyle {
  const modeStyle = POLYLINE_MODE_STYLES[mode];
  return {
    ...modeStyle,
    width: modeStyle.width + (selected ? 2 : active ? 0.75 : 0),
    opacity: selected ? 1 : active ? 0.92 : 0.68,
    directional: true,
    directionScale: modeStyle.directionScale + (selected ? 0.45 : 0),
  };
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
    line.handle.setStyle(getPolylineStyle(line.mode, selected, active));
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

/** Projects Trip data to provider-neutral map objects; owns no domain mutations. */
export const TripLayer = memo(function TripLayer({
  objects,
  trip,
  selectedPlaceId,
  selectedPolylineId,
  selectedDayId,
  visibleDayIds,
  onSelectPlace,
  onSelectPolyline,
}: Props) {
  const markers = useRef(
    new Map<
      string,
      {
        handle: MapMarkerHandle;
        unsubscribe: () => void;
        dayId: string;
        order: number;
      }
    >(),
  );
  const lines = useRef(new Map<string, OwnedPolyline>());
  const placeSelection = useRef(onSelectPlace);
  const polylineSelection = useRef(onSelectPolyline);
  useLayoutEffect(() => {
    placeSelection.current = onSelectPlace;
    polylineSelection.current = onSelectPolyline;
  }, [onSelectPlace, onSelectPolyline]);
  const tripId = trip.id;
  const selectedPlaceIdRef = useRef(selectedPlaceId);
  const selectedPolylineIdRef = useRef(selectedPolylineId);
  const selectedDayIdRef = useRef(selectedDayId);
  const visibleDayIdsRef = useRef(visibleDayIds);
  useLayoutEffect(() => {
    selectedPlaceIdRef.current = selectedPlaceId;
    selectedPolylineIdRef.current = selectedPolylineId;
    selectedDayIdRef.current = selectedDayId;
    visibleDayIdsRef.current = visibleDayIds;
  }, [selectedDayId, selectedPlaceId, selectedPolylineId, visibleDayIds]);

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
    for (const day of trip.days) {
      const visible = visibleDayIdsRef.current.has(day.id);
      const layerOrder = new Map(
        day.layerItems.map(
          (item, index) => [`${item.type}:${item.id}`, index + 1] as const,
        ),
      );
      for (const place of day.places) {
        const placeStyle = resolvePlaceStyle(place.placeStyle, day.color);
        const order = layerOrder.get(`place:${place.id}`) ?? place.order;
        remaining.add(place.id);
        let marker = markers.current.get(place.id);
        if (!marker) {
          const handle = objects.addMarker({
            id: `${tripId}:place:${place.id}`,
            layer: 'itinerary-markers',
            position: place.location,
          });
          const unsubscribeClick = handle.onClick(() =>
            placeSelection.current(place.id),
          );
          marker = {
            handle,
            unsubscribe: () => {
              unsubscribeClick();
            },
            dayId: day.id,
            order,
          };
          markers.current.set(place.id, marker);
        }
        marker.dayId = day.id;
        marker.order = order;
        marker.handle.setPosition(place.location);
        marker.handle.setTitle(`${day.title} · ${place.order}. ${place.name}`);
        marker.handle.setColor(placeStyle.color);
        marker.handle.setIcon(getPlaceStyleOption(placeStyle.type).icon);
        marker.handle.setSelected(selectedPlaceIdRef.current === place.id);
        marker.handle.setEmphasis('none');
        marker.handle.setVisible(visible);
        marker.handle.setZIndex(
          getMarkerZIndex(selectedPlaceIdRef.current === place.id, order),
        );
      }
    }
    for (const [id, marker] of markers.current) {
      if (!remaining.has(id)) {
        marker.unsubscribe();
        marker.handle.remove();
        markers.current.delete(id);
      }
    }
    const remainingPolylines = new Set<string>();
    for (const day of trip.days) {
      const layerOrder = new Map(
        day.layerItems.map(
          (item, index) => [`${item.type}:${item.id}`, index + 1] as const,
        ),
      );
      for (const polyline of day.polylines) {
        const order =
          layerOrder.get(`polyline:${polyline.id}`) ?? polyline.order;
        remainingPolylines.add(polyline.id);
        const path = getPolylinePath(day, polyline);
        const selected = selectedPolylineIdRef.current === polyline.id;
        const active = selectedDayIdRef.current === day.id;
        const visible = visibleDayIdsRef.current.has(day.id) && path.length > 1;
        let line = lines.current.get(polyline.id);
        if (!line) {
          const styleKey = getPolylineStyleKey(polyline.mode, selected, active);
          const zIndex = getPolylineZIndex(selected, active, order);
          const handle = objects.addPolyline({
            id: `${tripId}:polyline:${polyline.id}`,
            layer: 'itinerary-polylines',
            path,
            style: getPolylineStyle(polyline.mode, selected, active),
            visible,
            zIndex,
          });
          line = {
            handle,
            unsubscribe: handle.onClick((anchor) =>
              polylineSelection.current(polyline.id, anchor),
            ),
            dayId: day.id,
            mode: polyline.mode,
            order,
            path,
            styleKey,
            visible,
            zIndex,
          };
          lines.current.set(polyline.id, line);
        }
        syncPolylineState(line, {
          dayId: day.id,
          mode: polyline.mode,
          order,
          path,
          selected,
          active,
          visible,
        });
      }
    }
    for (const [id, line] of lines.current) {
      if (!remainingPolylines.has(id)) {
        line.unsubscribe();
        line.handle.remove();
        lines.current.delete(id);
      }
    }
  }, [objects, tripId, trip]);

  const previousSelectedPlaceId = useRef<string | null>(null);
  useEffect(() => {
    const previousId = previousSelectedPlaceId.current;
    if (previousId && previousId !== selectedPlaceId) {
      const previous = markers.current.get(previousId);
      previous?.handle.setSelected(false);
      previous?.handle.setZIndex(previous.order);
    }
    if (selectedPlaceId) {
      const selected = markers.current.get(selectedPlaceId);
      selected?.handle.setSelected(true);
      selected?.handle.setZIndex(10000);
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
    for (const day of trip.days) {
      const visible = visibleDayIds.has(day.id);
      for (const place of day.places) {
        markers.current.get(place.id)?.handle.setVisible(visible);
      }
    }
    for (const line of lines.current.values()) {
      syncPolylineVisibility(
        line,
        visibleDayIds.has(line.dayId) && line.path.length > 1,
      );
    }
  }, [trip.days, visibleDayIds]);

  return null;
});
