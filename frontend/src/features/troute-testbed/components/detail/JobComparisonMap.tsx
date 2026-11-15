import { useEffect, useRef } from 'react';
import { type JobComparisonLocation } from '@/features/troute-testbed/components/detail/jobResultMapModel';
import type { MapMarkerHandle } from '@/map/adapters/MapObjectController';
import { GoogleMap, useGoogleMap } from '@/map/components/GoogleMap';
import { useMapPolyline } from '@/map/hooks/useMapPolyline';

export function JobComparisonMap({
  ariaLabel,
  layer,
  locations,
}: {
  ariaLabel: string;
  layer: string;
  locations: readonly JobComparisonLocation[];
}) {
  return (
    <GoogleMap
      className="job-result-google-map"
      center={locations[0]?.position ?? { lat: 37.5665, lng: 126.978 }}
      zoom={12}
      ariaLabel={ariaLabel}
      options={{
        clickableIcons: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      <JobComparisonViewport locations={locations} />
      <JobComparisonOrderingLine layer={layer} locations={locations} />
      <JobComparisonMarkers layer={layer} locations={locations} />
    </GoogleMap>
  );
}

export function JobComparisonOrderingLine({
  layer,
  locations,
}: {
  layer: string;
  locations: readonly JobComparisonLocation[];
}) {
  const { objects } = useGoogleMap();
  useMapPolyline(objects, {
    id: `${layer}:ordering-line`,
    layer: `${layer}-ordering-line`,
    path: locations.map((location) => location.position),
    style: {
      color: '#f59e0b',
      width: 3,
      opacity: 0.78,
      directional: true,
      directionRepeatPx: 96,
      directionScale: 2.6,
    },
    zIndex: 0,
  });
  return null;
}

export function JobComparisonViewport({
  locations,
}: {
  locations: readonly JobComparisonLocation[];
}) {
  const { adapter } = useGoogleMap();
  const signature = locations
    .map(
      (location) =>
        `${location.key}:${location.position.lat}:${location.position.lng}`,
    )
    .join('|');

  useEffect(() => {
    if (locations.length === 0) {
      return;
    }
    if (locations.length === 1) {
      adapter.panTo(locations[0]!.position);
      adapter.setZoom(14);
      return;
    }
    const latitudes = locations.map((location) => location.position.lat);
    const longitudes = locations.map((location) => location.position.lng);
    adapter.fitBounds(
      {
        north: Math.max(...latitudes),
        south: Math.min(...latitudes),
        east: Math.max(...longitudes),
        west: Math.min(...longitudes),
      },
      { top: 44, right: 44, bottom: 44, left: 44 },
    );
  }, [adapter, locations, signature]);

  return null;
}

export function JobComparisonMarkers({
  layer,
  locations,
}: {
  layer: string;
  locations: readonly JobComparisonLocation[];
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
    locations.forEach((location, index) => {
      remaining.add(location.key);
      let marker = markers.current.get(location.key);
      if (!marker) {
        marker = objects.addMarker({
          id: `${layer}:${location.key}`,
          layer,
          position: location.position,
        });
        markers.current.set(location.key, marker);
      }
      marker.setPosition(location.position);
      marker.setTitle(`${index + 1}. ${location.name}`);
      marker.setLabel(String(index + 1));
      marker.setSelected(false);
      marker.setZIndex(index + 1);
    });

    for (const [key, marker] of markers.current) {
      if (!remaining.has(key)) {
        marker.remove();
        markers.current.delete(key);
      }
    }
  }, [layer, locations, objects]);

  return null;
}
