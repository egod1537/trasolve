import { Button, ButtonGroup, Classes } from '@blueprintjs/core';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { MapMarkerHandle } from '@/map/adapters/MapObjectController';
import { GoogleMap, useGoogleMap } from '@/map/components/GoogleMap';
import type {
  TcacheRouteAlternative,
  TcacheRouteLeg,
  TcacheRouteLocation,
} from '@/features/tcache-route-testbed/model/types';
import type { GeoPoint } from '@/shared/types/mapTypes';

interface TcacheResultMapProps {
  routes: TcacheRouteAlternative[];
  locations: TcacheRouteLocation[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const EMPTY_POINTS: readonly GeoPoint[] = [];
const EMPTY_LEGS: readonly TcacheRouteLeg[] = [];

export function TcacheResultMap({
  routes,
  locations,
  selectedIndex,
  onSelect,
}: TcacheResultMapProps) {
  const selected = routes[selectedIndex] ?? routes[0];
  const points = selected?.path ?? EMPTY_POINTS;
  const bounds = selected?.bounds;
  const markerModels = useMemo(
    () => createMarkerModels(locations, points, selected?.legs ?? EMPTY_LEGS),
    [locations, points, selected],
  );
  if (!selected) {
    return null;
  }
  return (
    <div className="tcache-result-map-section">
      {routes.length > 1 ? (
        <ButtonGroup className="tcache-result-route-selector" size="small">
          {routes.map((route, index) => (
            <Button
              key={route.id}
              active={index === selectedIndex}
              onClick={() => onSelect(index)}
            >
              {route.label || `경로 ${index + 1}`}
            </Button>
          ))}
        </ButtonGroup>
      ) : null}
      {points.length >= 2 || bounds ? (
        <GoogleMap
          className="tcache-result-map"
          center={
            points[0] ??
            (bounds
              ? {
                  lat: (bounds.north + bounds.south) / 2,
                  lng: (bounds.east + bounds.west) / 2,
                }
              : undefined)
          }
          zoom={12}
          ariaLabel={`${selected.label} 결과 지도`}
          options={{
            clickableIcons: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          }}
          polylines={
            points.length >= 2
              ? [
                  {
                    id: selected.id,
                    path: points,
                    color: '#2563eb',
                    weight: 5,
                    opacity: 0.9,
                  },
                ]
              : []
          }
        >
          <ResultMarkers markers={markerModels} />
          <FitResultBounds
            points={points}
            bounds={bounds}
            routeId={selected.id}
          />
        </GoogleMap>
      ) : (
        <p className={Classes.TEXT_MUTED}>
          결과에 지도에 표시할 path/polyline 좌표가 없습니다.
        </p>
      )}
    </div>
  );
}

function FitResultBounds({
  points,
  bounds,
  routeId,
}: {
  points: readonly GeoPoint[];
  bounds: TcacheRouteAlternative['bounds'];
  routeId: string;
}) {
  const { adapter } = useGoogleMap();
  useEffect(() => {
    const nextBounds =
      bounds ??
      (points.length >= 2
        ? {
            north: Math.max(...points.map((point) => point.lat)),
            south: Math.min(...points.map((point) => point.lat)),
            east: Math.max(...points.map((point) => point.lng)),
            west: Math.min(...points.map((point) => point.lng)),
          }
        : null);
    if (nextBounds) {
      adapter.fitBounds(nextBounds, {
        top: 48,
        right: 48,
        bottom: 48,
        left: 48,
      });
    }
  }, [adapter, bounds, points, routeId]);
  return null;
}

interface MarkerModel {
  id: string;
  name: string;
  position: GeoPoint;
  label: string;
}

function ResultMarkers({ markers }: { markers: MarkerModel[] }) {
  const { objects } = useGoogleMap();
  const handles = useRef(new Map<string, MapMarkerHandle>());
  useEffect(() => {
    const owned = handles.current;
    return () => {
      owned.forEach((marker) => marker.remove());
      owned.clear();
    };
  }, [objects]);
  useLayoutEffect(() => {
    const remaining = new Set<string>();
    markers.forEach((marker, index) => {
      remaining.add(marker.id);
      let handle = handles.current.get(marker.id);
      if (!handle) {
        handle = objects.addMarker({
          id: `tcache-result:${marker.id}`,
          layer: 'tcache-result-markers',
          position: marker.position,
        });
        handles.current.set(marker.id, handle);
      }
      handle.setPosition(marker.position);
      handle.setLabel(marker.label);
      handle.setTitle(`${index + 1}. ${marker.name}`);
      handle.setZIndex(index + 1);
    });
    handles.current.forEach((handle, id) => {
      if (!remaining.has(id)) {
        handle.remove();
        handles.current.delete(id);
      }
    });
  }, [markers, objects]);
  return null;
}

function createMarkerModels(
  locations: TcacheRouteLocation[],
  path: readonly GeoPoint[],
  legs: readonly TcacheRouteLeg[],
): MarkerModel[] {
  const models = locations.flatMap((location, index) =>
    location.lat === undefined || location.lng === undefined
      ? []
      : [
          {
            id: location.id,
            name: location.name,
            position: { lat: location.lat, lng: location.lng },
            label: String(index + 1),
          },
        ],
  );
  if (models.length > 0) {
    return models;
  }
  const legPoints = [legs[0]?.start, ...legs.map((leg) => leg.end)].filter(
    (point): point is GeoPoint => point !== undefined,
  );
  if (legPoints.length >= 2) {
    return legPoints.map((point, index) => ({
      id: `route-leg-${index}`,
      name:
        index === 0
          ? '출발지'
          : index === legPoints.length - 1
            ? '도착지'
            : `경유지 ${index}`,
      position: point,
      label: String(index + 1),
    }));
  }
  if (path.length < 2) {
    return models;
  }
  return [
    { id: 'route-start', name: '출발지', position: path[0]!, label: 'S' },
    {
      id: 'route-end',
      name: '도착지',
      position: path.at(-1)!,
      label: 'E',
    },
  ];
}
