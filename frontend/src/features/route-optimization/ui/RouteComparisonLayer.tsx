import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { MapMarkerHandle } from '@/shared/map/MapMarkerHandle';
import { useGoogleMap } from '@/map/components/GoogleMap';
import { useMapPolyline } from '@/map/hooks/useMapPolyline';
import { formatPlaceVisitTime } from '@/entities/place';
import { getTripPolylineStyle } from '@/entities/trip';
import { getRouteMarkerRole } from '@/shared/map/routeMarkerRole';
import { ROUTE_COMPARISON_COLORS } from './routeComparisonStyle';
import {
  getComparisonPlaces,
  type RouteComparisonData,
  type RouteComparisonMode,
} from '@/features/route-optimization/model/routeComparison';

type Props = {
  data: RouteComparisonData;
  mode: RouteComparisonMode;
  sidebarRef: RefObject<HTMLElement | null>;
};

export function RouteComparisonLayer({ data, mode, sidebarRef }: Props) {
  const { adapter, objects, canvasRef } = useGoogleMap();
  const current = useMemo(() => getComparisonPlaces(data, 'current'), [data]);
  const result = useMemo(() => getComparisonPlaces(data, 'result'), [data]);
  const markerHandles = useRef(new Map<string, MapMarkerHandle>());
  const currentPath = useMemo(
    () => current.map((place) => place.location),
    [current],
  );
  const resultPath = useMemo(
    () => result.map((place) => place.location),
    [result],
  );
  useMapPolyline(objects, {
    id: 'route-review-current',
    layer: 'route-review-current',
    path: currentPath,
    visible: true,
    zIndex: mode === 'current' ? 20 : 10,
    style: {
      ...getTripPolylineStyle('straight', false, true),
      color: ROUTE_COMPARISON_COLORS.current,
      width: mode === 'current' ? 5 : 3,
      opacity: mode === 'current' ? 0.95 : 0.3,
      directional: true,
    },
  });
  useMapPolyline(objects, {
    id: 'route-review-result',
    layer: 'route-review-result',
    path: resultPath,
    visible: true,
    zIndex: mode === 'result' ? 20 : 10,
    style: {
      ...getTripPolylineStyle('straight', false, true),
      color: ROUTE_COMPARISON_COLORS.result,
      width: mode === 'result' ? 5 : 3,
      opacity: mode === 'result' ? 0.95 : 0.3,
      directional: true,
    },
  });

  useEffect(() => {
    const handles = markerHandles.current;
    for (const [index, place] of current.entries()) {
      handles.set(
        place.id,
        objects.addMarker({
          id: `route-review:${place.id}`,
          layer: 'route-review',
          position: place.location,
          title: place.name,
          label: String(index + 1),
          color: ROUTE_COMPARISON_COLORS.current,
          zIndex: 50 + index,
        }),
      );
    }
    return () => {
      for (const marker of handles.values()) {
        marker.remove();
      }
      handles.clear();
    };
  }, [current, objects]);

  useEffect(() => {
    const ordered = mode === 'current' ? current : result;
    const orderById = new Map(
      ordered.map((place, index) => [
        place.id,
        { index, visitTime: formatPlaceVisitTime(place) },
      ]),
    );
    for (const [id, marker] of markerHandles.current) {
      const entry = orderById.get(id);
      marker.setVisible(entry !== undefined);
      if (entry) {
        marker.setLabel(String(entry.index + 1));
        marker.setZIndex(50 + entry.index);
        marker.setColor(ROUTE_COMPARISON_COLORS[mode]);
        marker.setRouteRole(getRouteMarkerRole(entry.index, ordered.length));
        marker.setCallout(
          entry.visitTime
            ? { text: entry.visitTime, visibility: 'always' }
            : undefined,
        );
      }
    }
  }, [current, mode, objects, result]);

  useEffect(() => {
    const camera = adapter.getCamera();
    const fit = () => {
      if (!current.length) {
        return;
      }
      const canvas = canvasRef.current?.getBoundingClientRect();
      const sidebar = sidebarRef.current?.getBoundingClientRect();
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      const latitudes = current.map((place) => place.location.lat);
      const longitudes = current.map((place) => place.location.lng);
      adapter.fitBounds(
        {
          north: Math.max(...latitudes),
          south: Math.min(...latitudes),
          east: Math.max(...longitudes),
          west: Math.min(...longitudes),
        },
        {
          top:
            mobile && sidebar && canvas ? sidebar.bottom - canvas.top + 64 : 80,
          left:
            !mobile && sidebar && canvas
              ? sidebar.right - canvas.left + 24
              : 24,
          right: 32,
          bottom: 200,
        },
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (canvasRef.current) {
      observer.observe(canvasRef.current);
    }
    if (sidebarRef.current) {
      observer.observe(sidebarRef.current);
    }
    return () => {
      observer.disconnect();
      if (camera) {
        adapter.setZoom(camera.zoom);
        adapter.panTo(camera.center);
      }
    };
  }, [adapter, canvasRef, current, sidebarRef]);
  return null;
}
