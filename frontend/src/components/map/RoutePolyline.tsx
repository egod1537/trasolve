import { useEffect, useRef } from 'react';
import type { TripRoute } from '../../types/trip';

export function RoutePolyline({
  map,
  route,
  active,
}: {
  map: google.maps.Map;
  route: TripRoute;
  active: boolean;
}) {
  const lineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    const line = new google.maps.Polyline({
      map,
      path: route.path,
      strokeColor: route.color,
      clickable: false,
      geodesic: false,
    });
    lineRef.current = line;
    return () => {
      line.setMap(null);
      lineRef.current = null;
    };
  }, [map, route]);

  useEffect(() => {
    lineRef.current?.setOptions({
      strokeOpacity: active ? 0.9 : 0.35,
      strokeWeight: active ? 4 : 3,
      zIndex: active ? 2 : 1,
    });
  }, [active, map, route]);

  return null;
}
