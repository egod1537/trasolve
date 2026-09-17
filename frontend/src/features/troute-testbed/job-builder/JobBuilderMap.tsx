import type { PlaceDetails } from '@trasolve/shared';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { GoogleMap, useGoogleMap } from '@/map/components/GoogleMap';
import type { MapMarkerHandle } from '@/map/adapters/MapObjectController';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import type { MapClickEvent } from '@/shared/types/mapTypes';
import {
  MapSearchToolbar,
  useSelectedGooglePlace,
} from '@/features/place-editor';
import type { JobBuilderLocation } from '@/features/troute-testbed/job-builder/jobBuilderModel';

interface JobBuilderMapProps {
  locations: JobBuilderLocation[];
  viewportRevision: number;
  selectedLocationId: string | null;
  onSelectLocation: (locationId: string) => void;
  onAddPlace: (place: PlaceDetails) => string;
}

export function JobBuilderMap({
  locations,
  viewportRevision,
  selectedLocationId,
  onSelectLocation,
  onAddPlace,
}: JobBuilderMapProps) {
  const mapRef = useRef<GoogleMapHandle>(null);
  const locationsRef = useRef(locations);
  const suppressSelectionPanRef = useRef<string | null>(null);
  const googlePlace = useSelectedGooglePlace();
  const selectedLocation = locations.find(
    (location) => location.id === selectedLocationId,
  );
  const selectedLocationSignature = selectedLocation
    ? `${selectedLocation.id}:${selectedLocation.location.lat}:${selectedLocation.location.lng}`
    : '';
  const selectedPlace =
    googlePlace.selection?.status === 'loaded'
      ? googlePlace.selection.place
      : null;
  const alreadyAddedLocation = selectedPlace
    ? locations.find((location) => location.placeId === selectedPlace.id)
    : undefined;

  const getSearchBias = useCallback(() => {
    const center = mapRef.current?.getCenter();
    return center ? { ...center, radiusMeters: 50_000 } : undefined;
  }, []);

  const selectSearchedPlace = useCallback(
    (place: PlaceDetails) => {
      mapRef.current?.panTo(place.location);
      mapRef.current?.setZoom(15);
      googlePlace.show(place);
    },
    [googlePlace],
  );

  const handleMapClick = useCallback(
    (event: MapClickEvent) => {
      if (event.placeId) {
        googlePlace.select(event.placeId, {
          lat: event.lat,
          lng: event.lng,
        });
        return;
      }
      googlePlace.close();
    },
    [googlePlace],
  );

  useLayoutEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

  useEffect(() => {
    if (suppressSelectionPanRef.current === selectedLocationId) {
      suppressSelectionPanRef.current = null;
      return;
    }
    const selected = locationsRef.current.find(
      (location) => location.id === selectedLocationId,
    );
    if (selected) {
      mapRef.current?.panTo(selected.location);
    }
  }, [selectedLocationId, selectedLocationSignature]);

  return (
    <div className="job-builder-map">
      <GoogleMap
        ref={mapRef}
        center={{ lat: 37.5665, lng: 126.978 }}
        zoom={12}
        ariaLabel="Job 위치 선택 지도"
        options={{
          clickableIcons: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
        onMapClick={handleMapClick}
      >
        <JobBuilderInitialViewport
          locations={locations}
          revision={viewportRevision}
        />
        <JobBuilderMarkers
          locations={locations}
          selectedLocationId={selectedLocationId}
          onSelectLocation={onSelectLocation}
        />
      </GoogleMap>

      <MapSearchToolbar
        aiOpen={false}
        quickSearchShortcutLabel=""
        getSearchBias={getSearchBias}
        onOpenQuickSearch={() => undefined}
        onSelectPlace={selectSearchedPlace}
        showQuickSearch={false}
      />

      {googlePlace.selection ? (
        <section className="job-builder-place-candidate" aria-live="polite">
          <button
            type="button"
            className="job-builder-candidate-close"
            aria-label="선택한 장소 닫기"
            onClick={googlePlace.close}
          >
            ×
          </button>
          {googlePlace.selection.status === 'loading' ? (
            <p role="status">장소 정보를 불러오고 있습니다.</p>
          ) : googlePlace.selection.status === 'error' ? (
            <p role="alert">장소 정보를 불러오지 못했습니다.</p>
          ) : (
            <>
              <strong>{googlePlace.selection.place.name}</strong>
              <span>
                {googlePlace.selection.place.address ?? '주소 정보 없음'}
              </span>
              <button
                type="button"
                className="job-builder-add-place"
                onClick={() => {
                  if (!selectedPlace) {
                    return;
                  }
                  const locationId = onAddPlace(selectedPlace);
                  if (selectedLocationId !== locationId) {
                    suppressSelectionPanRef.current = locationId;
                  }
                  onSelectLocation(locationId);
                  googlePlace.close();
                }}
              >
                {alreadyAddedLocation ? '추가된 장소 선택' : 'Job에 추가'}
              </button>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function JobBuilderInitialViewport({
  locations,
  revision,
}: {
  locations: JobBuilderLocation[];
  revision: number;
}) {
  const { adapter } = useGoogleMap();
  const appliedRevision = useRef(-1);

  useEffect(() => {
    if (appliedRevision.current === revision || locations.length < 2) {
      return;
    }
    const latitudes = locations.map((location) => location.location.lat);
    const longitudes = locations.map((location) => location.location.lng);
    adapter.fitBounds(
      {
        north: Math.max(...latitudes),
        south: Math.min(...latitudes),
        east: Math.max(...longitudes),
        west: Math.min(...longitudes),
      },
      { top: 88, right: 48, bottom: 48, left: 48 },
    );
    appliedRevision.current = revision;
  }, [adapter, locations, revision]);

  return null;
}

function JobBuilderMarkers({
  locations,
  selectedLocationId,
  onSelectLocation,
}: Pick<
  JobBuilderMapProps,
  'locations' | 'selectedLocationId' | 'onSelectLocation'
>) {
  const { objects } = useGoogleMap();
  const markers = useRef(
    new Map<string, { handle: MapMarkerHandle; unsubscribe: () => void }>(),
  );
  const selection = useRef(onSelectLocation);

  useLayoutEffect(() => {
    selection.current = onSelectLocation;
  }, [onSelectLocation]);

  useEffect(() => {
    const ownedMarkers = markers.current;
    return () => {
      for (const marker of ownedMarkers.values()) {
        marker.unsubscribe();
        marker.handle.remove();
      }
      ownedMarkers.clear();
    };
  }, [objects]);

  useEffect(() => {
    const remaining = new Set<string>();
    locations.forEach((location, index) => {
      remaining.add(location.id);
      let marker = markers.current.get(location.id);
      if (!marker) {
        const handle = objects.addMarker({
          id: `job-builder:${location.id}`,
          layer: 'job-builder-markers',
          position: location.location,
        });
        const unsubscribe = handle.onClick(() =>
          selection.current(location.id),
        );
        marker = { handle, unsubscribe };
        markers.current.set(location.id, marker);
      }
      marker.handle.setPosition(location.location);
      marker.handle.setTitle(`${index + 1}. ${location.name}`);
      marker.handle.setLabel(String(index + 1));
      marker.handle.setSelected(selectedLocationId === location.id);
      marker.handle.setZIndex(
        selectedLocationId === location.id ? 10_000 : index + 1,
      );
    });

    for (const [locationId, marker] of markers.current) {
      if (!remaining.has(locationId)) {
        marker.unsubscribe();
        marker.handle.remove();
        markers.current.delete(locationId);
      }
    }
  }, [locations, objects, selectedLocationId]);

  return null;
}
