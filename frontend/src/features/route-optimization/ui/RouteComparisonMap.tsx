import type { TripPlace } from '@trasolve/shared';
import { useEffect, useRef } from 'react';
import type { MapMarkerHandle } from '@/map/adapters/MapObjectController';
import { GoogleMap, useGoogleMap } from '@/map/components/GoogleMap';
import { useMapPolyline } from '@/map/hooks/useMapPolyline';
import type { RouteGeometryState } from '@/features/route-optimization/model/useRouteGeometry';

type Props = {
  title: 'Before' | 'After';
  ariaLabel: string;
  layer: string;
  color: string;
  places: readonly TripPlace[];
  geometry: RouteGeometryState;
};

export function RouteComparisonMap({
  title,
  ariaLabel,
  layer,
  color,
  places,
  geometry,
}: Props) {
  return (
    <section className="route-optimization-map-panel">
      <header>
        <div>
          <strong>{title}</strong>
          <span>
            {title === 'Before' ? '현재 방문 순서' : '최적화 방문 순서'}
          </span>
        </div>
        <div className="route-optimization-map-status">
          <span className="route-optimization-marker-legend">
            <i className="is-start" /> 출발
            <i className="is-destination" /> 도착
          </span>
          <GeometryBadge status={geometry.status} />
        </div>
      </header>
      <GoogleMap
        className="route-optimization-google-map"
        center={places[0]?.location ?? { lat: 37.5665, lng: 126.978 }}
        zoom={12}
        ariaLabel={ariaLabel}
        options={{
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        <ComparisonViewport places={places} />
        <ComparisonLine layer={layer} color={color} path={geometry.path} />
        <ComparisonMarkers layer={layer} color={color} places={places} />
      </GoogleMap>
      <p className="route-optimization-map-order">
        {places.map((place) => place.name).join(' → ')}
      </p>
    </section>
  );
}

function GeometryBadge({ status }: { status: RouteGeometryState['status'] }) {
  return (
    <span className={`route-optimization-geometry is-${status}`}>
      {status === 'ready'
        ? '실제 경로'
        : status === 'loading'
          ? '경로 조회 중'
          : '실제 경로 geometry 없음 · 직선 연결'}
    </span>
  );
}

function ComparisonViewport({ places }: { places: readonly TripPlace[] }) {
  const { adapter } = useGoogleMap();
  const signature = places
    .map((place) => `${place.id}:${place.location.lat}:${place.location.lng}`)
    .sort()
    .join('|');

  useEffect(() => {
    if (places.length === 0) {
      return;
    }
    if (places.length === 1) {
      adapter.panTo(places[0]!.location);
      adapter.setZoom(14);
      return;
    }
    const latitudes = places.map((place) => place.location.lat);
    const longitudes = places.map((place) => place.location.lng);
    adapter.fitBounds(
      {
        north: Math.max(...latitudes),
        south: Math.min(...latitudes),
        east: Math.max(...longitudes),
        west: Math.min(...longitudes),
      },
      { top: 44, right: 44, bottom: 44, left: 44 },
    );
  }, [adapter, places, signature]);
  return null;
}

function ComparisonLine({
  layer,
  color,
  path,
}: {
  layer: string;
  color: string;
  path: RouteGeometryState['path'];
}) {
  const { objects } = useGoogleMap();
  useMapPolyline(objects, {
    id: `${layer}:route`,
    layer: `${layer}-line`,
    path,
    style: {
      color,
      width: 4,
      opacity: 0.86,
      directional: true,
      directionRepeatPx: 90,
      directionScale: 2.4,
    },
  });
  return null;
}

function ComparisonMarkers({
  layer,
  color,
  places,
}: {
  layer: string;
  color: string;
  places: readonly TripPlace[];
}) {
  const { objects } = useGoogleMap();
  const markers = useRef(new Map<string, MapMarkerHandle>());

  useEffect(() => {
    const ownedMarkers = markers.current;
    return () => {
      for (const marker of ownedMarkers.values()) {
        marker.remove();
      }
      ownedMarkers.clear();
    };
  }, [objects]);

  useEffect(() => {
    const remaining = new Set<string>();
    places.forEach((place, index) => {
      remaining.add(place.id);
      let marker = markers.current.get(place.id);
      if (!marker) {
        marker = objects.addMarker({
          id: `${layer}:${place.id}`,
          layer,
          position: place.location,
        });
        markers.current.set(place.id, marker);
      }
      marker.setPosition(place.location);
      marker.setTitle(
        `${index + 1}. ${place.name}${
          index === 0 ? ' · 출발' : index === places.length - 1 ? ' · 도착' : ''
        }`,
      );
      marker.setLabel(String(index + 1));
      marker.setColor(
        index === 0
          ? '#16a34a'
          : index === places.length - 1
            ? '#dc2626'
            : color,
      );
      marker.setZIndex(index + 1);
    });
    for (const [placeId, marker] of markers.current) {
      if (!remaining.has(placeId)) {
        marker.remove();
        markers.current.delete(placeId);
      }
    }
  }, [color, layer, objects, places]);
  return null;
}
