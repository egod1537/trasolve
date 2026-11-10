import { useEffect, useRef } from 'react';
import { useGoogleMap } from '@/map/components/GoogleMap';
import type { MapMarkerHandle } from '@/shared/map/MapMarkerHandle';
import type { Measurement } from './useMeasurement';
import { useL } from '@/shared/i18n';

export function MeasurementLayer({
  measurement,
}: {
  measurement: Measurement;
}) {
  const { objects } = useGoogleMap();
  const { tool, points, move } = measurement;
  const L = useL();
  const markers = useRef<MapMarkerHandle[]>([]);
  useEffect(() => {
    while (markers.current.length > points.length) {
      markers.current.pop()?.remove();
    }
    points.forEach((position, index) => {
      let marker = markers.current[index];
      if (!marker) {
        marker = objects.addMarker({
          position,
          draggable: true,
          zIndex: 10000,
          label: String(index + 1),
          color: '#4465e8',
        });
        marker.onDragEnd((point) => move(index, point));
        markers.current.push(marker);
      }
      marker.setTitle(L('map:measurement.point', { index: index + 1 }));
      marker.setPosition(position);
    });
  }, [objects, points, move, L]);
  useEffect(
    () => () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
    },
    [objects],
  );
  useEffect(() => {
    if (tool === 'pan' || points.length < 2) {
      return;
    }
    const path =
      tool === 'area' && points.length >= 3 ? [...points, points[0]] : points;
    const line = objects.addPolyline({
      path,
      zIndex: 9999,
      style: { color: '#4465e8', width: 3 },
    });
    const polygon =
      tool === 'area' && points.length >= 3
        ? objects.addPolygon?.({
            path: points,
            zIndex: 9998,
            style: {
              strokeOpacity: 0,
              fillColor: '#4465e8',
              fillOpacity: 0.16,
            },
          })
        : undefined;
    return () => {
      line.remove();
      polygon?.remove();
    };
  }, [objects, tool, points]);
  return null;
}
