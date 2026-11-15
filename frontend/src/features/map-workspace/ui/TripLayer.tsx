import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Trip } from '@trasolve/shared';
import type { MapObjectController } from '@/map/adapters/MapObjectController';
import type { GeoPoint } from '@/shared/types/mapTypes';
import { getTripPolylineStyle } from '@/entities/trip';
import {
  type OwnedPolyline,
  getPolylineStyleKey,
  getPolylineZIndex,
  syncPolylinePresentation,
  syncPolylineVisibility,
  syncPolylineState,
  getMarkerZIndex,
  type OwnedMarker,
  toTripLayerModel,
  syncMarkerState,
  syncMarkerVisibility,
  getMarkerVisibility,
  getPolylineVisibility,
} from '@/features/map-workspace/ui/tripLayerModel';

type Props = {
  objects: MapObjectController;
  trip: Trip;
  selectedPlaceId: string | null;
  selectedPolylineId: string | null;
  selectedDayId: string | null;
  visibleDayIds: ReadonlySet<string>;
  isZooming: boolean;
  onSelectPlace: (id: string) => void;
  onFocusPlace: (id: string) => void;
  onSelectPolyline: (id: string, anchor: GeoPoint) => void;
};

export const TripLayer = memo(function TripLayer({
  objects,
  trip,
  selectedPlaceId,
  selectedPolylineId,
  selectedDayId,
  visibleDayIds,
  isZooming,
  onSelectPlace,
  onFocusPlace,
  onSelectPolyline,
}: Props) {
  const markers = useRef(new Map<string, OwnedMarker>());
  const lines = useRef(new Map<string, OwnedPolyline>());
  const placeSelection = useRef(onSelectPlace);
  const placeFocus = useRef(onFocusPlace);
  const polylineSelection = useRef(onSelectPolyline);
  useLayoutEffect(() => {
    placeSelection.current = onSelectPlace;
    placeFocus.current = onFocusPlace;
    polylineSelection.current = onSelectPolyline;
  }, [onFocusPlace, onSelectPlace, onSelectPolyline]);
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
          routeRole: place.routeRole,
          callout: place.visitTime
            ? { text: place.visitTime, visibility: 'hover' }
            : undefined,
          color: place.color,
          icon: place.icon,
          selected,
          visible,
          zIndex,
        });
        const unsubscribeClick = handle.onClick(() =>
          placeSelection.current(place.id),
        );
        const unsubscribeDoubleClick = handle.onDoubleClick(() =>
          placeFocus.current(place.id),
        );
        marker = {
          handle,
          unsubscribe: () => {
            unsubscribeClick();
            unsubscribeDoubleClick();
          },
          dayId: place.dayId,
          order: place.order,
          position: place.position,
          title: place.title,
          visitTime: place.visitTime,
          routeRole: place.routeRole,
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
        visitTime: place.visitTime,
        routeRole: place.routeRole,
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
