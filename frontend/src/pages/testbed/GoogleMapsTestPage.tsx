import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { GooglePlaceSearch } from '@/pages/testbed/components/google-maps/GooglePlaceSearch';
import type {
  GoogleMapHandle,
  LatLng,
  MapClickEvent,
  MapPlace,
} from '@/map/types/googleMapComponent';
import { DirectionsPanel } from '@/pages/testbed/components/google-maps/DirectionsPanel';
import { MapPanel } from '@/pages/testbed/components/google-maps/MapPanel';
import { SelectionPanel } from '@/pages/testbed/components/google-maps/SelectionPanel';
import { RouteResultPanel } from '@/pages/testbed/components/google-maps/RouteResultPanel';
import { DebugPanel } from '@/pages/testbed/components/google-maps/DebugPanel';
import {
  initialCenter,
  initialZoom,
  routePadding,
} from '@/pages/testbed/components/google-maps/config';
import { useDirectionsState } from '@/pages/testbed/hooks/useDirectionsState';
import '@/pages/testbed/styles/google-maps-test.css';
import { useL } from '@/shared/i18n';

function GoogleMapsTestContent() {
  const L = useL();
  const mapRef = useRef<GoogleMapHandle>(null);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [clicked, setClicked] = useState<MapClickEvent | null>(null);
  const [camera, setCamera] = useState<LatLng | null>(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [logs, setLogs] = useState<string[]>([]);
  const appendLog = useCallback((message: string) => {
    setLogs((current) => [message, ...current].slice(0, 20));
  }, []);
  const directions = useDirectionsState(appendLog);
  const { route } = directions;

  const handleFitBounds = useCallback(() => {
    if (route?.bounds) {
      mapRef.current?.fitBounds(route.bounds, routePadding);
    }
  }, [route]);
  useEffect(handleFitBounds, [handleFitBounds]);

  const handlePlaceSelect = useCallback(
    (place: MapPlace) => {
      setSelectedPlace(place);
      mapRef.current?.setZoom(15);
      mapRef.current?.panTo(place.location);
      appendLog(
        L(
          'testbed:googleMapsTestPage.googleMapsTestContent.text.selectLocation',
          { name: place.name },
        ),
      );
    },
    [appendLog, L],
  );

  const handleMapReady = useCallback(
    (map: GoogleMapHandle) => {
      setCamera(initialCenter);
      setZoom(initialZoom);
      appendLog(
        L('testbed:googleMapsTestPage.googleMapsTestContent.text.mapReady'),
      );
      if (route?.bounds) {
        map.fitBounds(route.bounds, routePadding);
      } else if (selectedPlace) {
        map.setZoom(15);
        map.panTo(selectedPlace.location);
      }
    },
    [appendLog, L, route, selectedPlace],
  );

  const handleMapClick = useCallback(
    (event: MapClickEvent) => {
      setClicked(event);
      appendLog(
        L('testbed:googleMapsTestPage.googleMapsTestContent.text.mapClick', {
          lat: event.lat,
          lng: event.lng,
          value: event.placeId ? ` · placeId: ${event.placeId}` : '',
        }),
      );
    },
    [appendLog, L],
  );

  const handleError = useCallback(
    (error: Error) => {
      appendLog(error.message);
    },
    [appendLog],
  );

  return (
    <main className="maps-test-page">
      <header>
        <a href="/testbed">
          {L('testbed:aiChatTestPage.aiChatTestContent.text.testbedList')}
        </a>
        <h1>
          {L(
            'testbed:googleMapsTestPage.googleMapsTestContent.title.googleMapsTestBed',
          )}
        </h1>
        <p>
          {L(
            'testbed:googleMapsTestPage.googleMapsTestContent.description.playgroundDevelopmentRealGoogleApi',
          )}
        </p>
      </header>
      <div className="maps-test-workspace">
        <aside
          className="maps-test-controls"
          aria-label={L(
            'testbed:googleMapsTestPage.googleMapsTestContent.ariaLabel.mapControl',
          )}
        >
          <GooglePlaceSearch
            onSelect={handlePlaceSelect}
            onError={handleError}
          />
          <DirectionsPanel
            origin={directions.origin}
            intermediates={directions.intermediates}
            destination={directions.destination}
            travelMode={directions.travelMode}
            alternatives={directions.alternatives}
            pending={directions.pending}
            canAddIntermediate={directions.canAddIntermediate}
            onOriginChange={directions.changeOrigin}
            onIntermediateAdd={() => directions.addIntermediate()}
            onIntermediateChange={directions.changeIntermediate}
            onIntermediateRemove={directions.removeIntermediate}
            onDestinationChange={directions.changeDestination}
            onTravelModeChange={directions.setTravelMode}
            onAlternativesChange={directions.setAlternatives}
            onSubmit={directions.findRoute}
          />
        </aside>
        <MapPanel
          mapRef={mapRef}
          polylines={directions.polylines}
          camera={camera}
          zoom={zoom}
          onReady={handleMapReady}
          onMapClick={handleMapClick}
          onCenterChanged={setCamera}
          onZoomChanged={setZoom}
          onError={handleError}
        />
      </div>
      <SelectionPanel
        clicked={clicked}
        selectedPlace={selectedPlace}
        pending={directions.pending}
        canAddIntermediate={directions.canAddIntermediate}
        onOriginSelect={directions.setOrigin}
        onIntermediateSelect={directions.addIntermediate}
        onDestinationSelect={directions.setDestination}
      />
      <RouteResultPanel
        apiStatus={directions.apiStatus}
        error={directions.error}
        request={directions.request}
        result={directions.result}
        route={route}
        routeIndex={directions.routeIndex}
        onSelectRoute={directions.setRouteIndex}
        onFitBounds={handleFitBounds}
      />
      <DebugPanel request={directions.request} route={route} logs={logs} />
    </main>
  );
}

export default class GoogleMapsTestPage extends Component {
  public render() {
    return <GoogleMapsTestContent />;
  }
}
