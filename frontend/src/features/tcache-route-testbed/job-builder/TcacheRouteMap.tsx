import type { PlaceDetails } from '@trasolve/shared';
import { Button, ButtonGroup } from '@blueprintjs/core';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  MapSearchToolbar,
  useSelectedGooglePlace,
} from '@/features/place-editor';
import {
  MAX_TCACHE_LOCATIONS,
  type TcacheRouteLocationDraft,
} from '@/features/tcache-route-testbed/job-builder/tcacheJobBuilderModel';
import { GoogleMap, useGoogleMap } from '@/map/components/GoogleMap';
import type { MapMarkerHandle } from '@/map/adapters/MapObjectController';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import type { GeoPoint, MapClickEvent } from '@/shared/types/mapTypes';
import { useL } from '@/shared/i18n';

interface TcacheRouteMapProps {
  locations: TcacheRouteLocationDraft[];
  selectedLocationId: string | null;
  viewportRevision: number;
  onSelectLocation: (locationId: string) => void;
  onUsePlace: (
    place: PlaceDetails,
    action: 'start' | 'waypoint' | 'end',
  ) => void;
  onUseCoordinate: (
    point: GeoPoint,
    action: 'start' | 'waypoint' | 'end',
  ) => void;
}

export function TcacheRouteMap({
  locations,
  selectedLocationId,
  viewportRevision,
  onSelectLocation,
  onUsePlace,
  onUseCoordinate,
}: TcacheRouteMapProps) {
  const L = useL();
  const mapRef = useRef<GoogleMapHandle>(null);
  const googlePlace = useSelectedGooglePlace();
  const [coordinateCandidate, setCoordinateCandidate] =
    useState<GeoPoint | null>(null);
  const selectedPlace =
    googlePlace.selection?.status === 'loaded'
      ? googlePlace.selection.place
      : null;

  const getSearchBias = useCallback(() => {
    const center = mapRef.current?.getCenter();
    return center ? { ...center, radiusMeters: 50_000 } : undefined;
  }, []);

  const showPlace = useCallback(
    (place: PlaceDetails) => {
      setCoordinateCandidate(null);
      mapRef.current?.panTo(place.location);
      mapRef.current?.setZoom(15);
      googlePlace.show(place);
    },
    [googlePlace],
  );

  const handleMapClick = useCallback(
    (event: MapClickEvent) => {
      if (event.placeId) {
        setCoordinateCandidate(null);
        googlePlace.select(event.placeId, event);
      } else {
        googlePlace.close();
        setCoordinateCandidate({ lat: event.lat, lng: event.lng });
      }
    },
    [googlePlace],
  );

  return (
    <div className="tcache-builder-map">
      <GoogleMap
        ref={mapRef}
        center={{ lat: 37.5665, lng: 126.978 }}
        zoom={12}
        ariaLabel={L(
          'testbed:tcacheRouteMap.ariaLabel.tcacheRouteRequestLocationMap',
        )}
        options={{
          clickableIcons: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
        onMapClick={handleMapClick}
      >
        <LocationMarkers
          locations={locations}
          selectedLocationId={selectedLocationId}
          onSelectLocation={onSelectLocation}
        />
        <FitLocationBounds locations={locations} revision={viewportRevision} />
      </GoogleMap>
      <MapSearchToolbar
        aiOpen={false}
        quickSearchShortcutLabel=""
        getSearchBias={getSearchBias}
        onOpenQuickSearch={() => undefined}
        onSelectPlace={showPlace}
        showQuickSearch={false}
      />
      {googlePlace.selection ? (
        <section className="tcache-place-candidate" aria-live="polite">
          <Button
            className="tcache-place-candidate-close"
            aria-label={L(
              'testbed:tcacheRouteMap.ariaLabel.closeSelectedPlace',
            )}
            icon="cross"
            size="small"
            variant="minimal"
            onClick={googlePlace.close}
          />
          {googlePlace.selection.status === 'loading' ? (
            <p role="status">
              {L(
                'testbed:tcacheRouteMap.description.loadingLocationInformation',
              )}
            </p>
          ) : googlePlace.selection.status === 'error' ? (
            <p role="alert">
              {L(
                'testbed:tcacheRouteMap.description.failedLoadLocationInformation',
              )}
            </p>
          ) : (
            <>
              <strong>{googlePlace.selection.place.name}</strong>
              <span>
                {googlePlace.selection.place.address ??
                  L('testbed:tcacheRouteMap.text.noAddressInformation')}
              </span>
              <ButtonGroup fill vertical>
                <Button
                  icon="locate"
                  onClick={() => {
                    if (selectedPlace) {
                      onUsePlace(selectedPlace, 'start');
                    }
                    googlePlace.close();
                  }}
                >
                  {L('testbed:tcacheRouteMap.action.setAsDeparturePoint')}
                </Button>
                <Button
                  icon="plus"
                  disabled={locations.length >= MAX_TCACHE_LOCATIONS}
                  onClick={() => {
                    if (selectedPlace) {
                      onUsePlace(selectedPlace, 'waypoint');
                    }
                    googlePlace.close();
                  }}
                >
                  {L('testbed:tcacheRouteMap.action.addAsStopover')}
                </Button>
                <Button
                  icon="flag"
                  onClick={() => {
                    if (selectedPlace) {
                      onUsePlace(selectedPlace, 'end');
                    }
                    googlePlace.close();
                  }}
                >
                  {L('testbed:tcacheRouteMap.action.setAsDestination')}
                </Button>
              </ButtonGroup>
            </>
          )}
        </section>
      ) : null}
      {!googlePlace.selection && coordinateCandidate ? (
        <section className="tcache-place-candidate" aria-live="polite">
          <Button
            className="tcache-place-candidate-close"
            aria-label={L(
              'testbed:tcacheRouteMap.ariaLabel.closeSelectedCoordinates',
            )}
            icon="cross"
            size="small"
            variant="minimal"
            onClick={() => setCoordinateCandidate(null)}
          />
          <strong>{L('testbed:tcacheRouteMap.text.mapCoordinates')}</strong>
          <span>
            {coordinateCandidate.lat.toFixed(6)},{' '}
            {coordinateCandidate.lng.toFixed(6)}
          </span>
          <ButtonGroup fill vertical>
            {(['start', 'waypoint', 'end'] as const).map((action) => (
              <Button
                key={action}
                disabled={
                  action === 'waypoint' &&
                  locations.length >= MAX_TCACHE_LOCATIONS
                }
                onClick={() => {
                  onUseCoordinate(coordinateCandidate, action);
                  setCoordinateCandidate(null);
                }}
              >
                {action === 'start'
                  ? L('testbed:tcacheRouteMap.action.setAsDeparturePoint')
                  : action === 'end'
                    ? L('testbed:tcacheRouteMap.action.setAsDestination')
                    : L('testbed:tcacheRouteMap.action.addAsStopover')}
              </Button>
            ))}
          </ButtonGroup>
        </section>
      ) : null}
    </div>
  );
}

function FitLocationBounds({
  locations,
  revision,
}: {
  locations: TcacheRouteLocationDraft[];
  revision: number;
}) {
  const { adapter } = useGoogleMap();
  const appliedRevision = useRef(-1);
  useEffect(() => {
    const points = locations.flatMap((location) =>
      location.lat === undefined || location.lng === undefined
        ? []
        : [{ lat: location.lat, lng: location.lng }],
    );
    if (appliedRevision.current === revision || points.length < 2) {
      return;
    }
    adapter.fitBounds(
      {
        north: Math.max(...points.map((point) => point.lat)),
        south: Math.min(...points.map((point) => point.lat)),
        east: Math.max(...points.map((point) => point.lng)),
        west: Math.min(...points.map((point) => point.lng)),
      },
      { top: 80, right: 48, bottom: 48, left: 48 },
    );
    appliedRevision.current = revision;
  }, [adapter, locations, revision]);
  return null;
}

function LocationMarkers({
  locations,
  selectedLocationId,
  onSelectLocation,
}: Pick<
  TcacheRouteMapProps,
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
    const owned = markers.current;
    return () => {
      owned.forEach((marker) => {
        marker.unsubscribe();
        marker.handle.remove();
      });
      owned.clear();
    };
  }, [objects]);
  useEffect(() => {
    const remaining = new Set<string>();
    locations.forEach((location, index) => {
      if (location.lat === undefined || location.lng === undefined) {
        return;
      }
      remaining.add(location.id);
      let marker = markers.current.get(location.id);
      if (!marker) {
        const handle = objects.addMarker({
          id: `tcache-builder:${location.id}`,
          layer: 'tcache-builder-markers',
          position: { lat: location.lat, lng: location.lng },
        });
        marker = {
          handle,
          unsubscribe: handle.onClick(() => selection.current(location.id)),
        };
        markers.current.set(location.id, marker);
      }
      marker.handle.setPosition({ lat: location.lat, lng: location.lng });
      marker.handle.setTitle(`${index + 1}. ${location.name}`);
      marker.handle.setLabel(String(index + 1));
      marker.handle.setSelected(location.id === selectedLocationId);
      marker.handle.setZIndex(
        location.id === selectedLocationId ? 10_000 : index + 1,
      );
    });
    markers.current.forEach((marker, id) => {
      if (!remaining.has(id)) {
        marker.unsubscribe();
        marker.handle.remove();
        markers.current.delete(id);
      }
    });
  }, [locations, objects, selectedLocationId]);
  return null;
}
