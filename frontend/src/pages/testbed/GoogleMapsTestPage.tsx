import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { GooglePlaceSearch } from './components/google-maps/GooglePlaceSearch';
import type {
  GoogleMapHandle,
  LatLng,
  MapClickEvent,
  MapPlace,
} from '../../map/types/googleMapComponent';
import { DirectionsPanel } from './components/google-maps/DirectionsPanel';
import { MapPanel } from './components/google-maps/MapPanel';
import { SelectionPanel } from './components/google-maps/SelectionPanel';
import { RouteResultPanel } from './components/google-maps/RouteResultPanel';
import { DebugPanel } from './components/google-maps/DebugPanel';
import {
  initialCenter,
  initialZoom,
  routePadding,
} from './components/google-maps/config';
import { useDirectionsState } from './hooks/useDirectionsState';
import './styles/google-maps-test.css';

function GoogleMapsTestContent() {
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
      appendLog(`장소 선택: ${place.name}`);
    },
    [appendLog],
  );

  const handleMapReady = useCallback(
    (map: GoogleMapHandle) => {
      setCamera(initialCenter);
      setZoom(initialZoom);
      appendLog('지도 준비 완료');
      if (route?.bounds) {
        map.fitBounds(route.bounds, routePadding);
      } else if (selectedPlace) {
        map.setZoom(15);
        map.panTo(selectedPlace.location);
      }
    },
    [appendLog, route, selectedPlace],
  );

  const handleMapClick = useCallback(
    (event: MapClickEvent) => {
      setClicked(event);
      appendLog(
        `지도 클릭: ${event.lat}, ${event.lng}${event.placeId ? ` · placeId: ${event.placeId}` : ''}`,
      );
    },
    [appendLog],
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
        <a href="/testbed">← 테스트베드 목록</a>
        <h1>Google Maps Test Bed</h1>
        <p>개발용 playground · 실제 Google API</p>
      </header>
      <div className="maps-test-workspace">
        <aside className="maps-test-controls" aria-label="지도 컨트롤">
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
