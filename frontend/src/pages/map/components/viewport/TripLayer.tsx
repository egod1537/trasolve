import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Trip } from '@trasolve/shared';
import type {
  MapMarkerHandle,
  MapObjectController,
  MapPolylineHandle,
} from '../../../../map/adapters/MapObjectController';
import type { TripRoute } from '../../domain/trip';

type Props = {
  objects: MapObjectController;
  trip: Trip;
  routes: readonly TripRoute[];
  selectedPlaceId: string | null;
  selectedDayId: string | null;
  onSelectPlace: (id: string) => void;
};

/** Projects Trip data to provider-neutral map objects; owns no domain mutations. */
export function TripLayer({
  objects,
  trip,
  routes,
  selectedPlaceId,
  selectedDayId,
  onSelectPlace,
}: Props) {
  const markers = useRef(
    new Map<string, { handle: MapMarkerHandle; unsubscribe: () => void }>(),
  );
  const lines = useRef(new Map<string, MapPolylineHandle>());
  const selection = useRef(onSelectPlace);
  useLayoutEffect(() => {
    selection.current = onSelectPlace;
  }, [onSelectPlace]);
  const tripId = trip.id;

  useEffect(() => {
    const ownedMarkers = markers.current,
      ownedLines = lines.current;
    return () => {
      for (const { handle, unsubscribe } of ownedMarkers.values()) {
        unsubscribe();
        handle.remove();
      }
      for (const handle of ownedLines.values()) handle.remove();
      ownedMarkers.clear();
      ownedLines.clear();
    };
  }, [objects, tripId]);

  useEffect(() => {
    const remaining = new Set<string>();
    for (const day of trip.days) {
      for (const place of day.places) {
        remaining.add(place.id);
        let marker = markers.current.get(place.id);
        if (!marker) {
          const handle = objects.addMarker({
            id: `${tripId}:place:${place.id}`,
            layer: 'itinerary-markers',
            position: place.location,
          });
          marker = {
            handle,
            unsubscribe: handle.onClick(() => selection.current(place.id)),
          };
          markers.current.set(place.id, marker);
        }
        marker.handle.setPosition(place.location);
        marker.handle.setLabel(String(place.order));
        marker.handle.setTitle(`${day.title} · ${place.order}. ${place.name}`);
        marker.handle.setColor(day.color);
        marker.handle.setSelected(selectedPlaceId === place.id);
        marker.handle.setZIndex(
          selectedPlaceId === place.id ? 1000 : place.order,
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
    const remainingRoutes = new Set(routes.map((route) => route.dayId));
    for (const route of routes) {
      let line = lines.current.get(route.dayId);
      if (!line) {
        line = objects.addPolyline({
          id: `${tripId}:route:${route.dayId}`,
          layer: 'itinerary-route',
          path: route.path,
        });
        lines.current.set(route.dayId, line);
      }
      const active = !selectedDayId || selectedDayId === route.dayId;
      line.setPath(route.path);
      line.setStyle({
        color: route.color,
        width: active ? 4 : 3,
        opacity: active ? 0.9 : 0.35,
      });
      line.setZIndex(active ? 1 : 0);
      line.setVisible(route.path.length > 1);
    }
    for (const [id, line] of lines.current) {
      if (!remainingRoutes.has(id)) {
        line.remove();
        lines.current.delete(id);
      }
    }
  }, [objects, tripId, trip, routes, selectedPlaceId, selectedDayId]);

  return null;
}
