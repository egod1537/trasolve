import type { RefObject } from 'react';
import { GoogleMap } from '../google-map/GoogleMap';
import type {
  GoogleMapHandle,
  MapClickEvent,
  MapPolyline,
  LatLng,
} from '../google-map/types';
import { Coordinates } from './Coordinates';
import { initialCenter, initialZoom, mapOptions } from './config';

type Props = {
  mapRef: RefObject<GoogleMapHandle | null>;
  polylines: MapPolyline[];
  camera: LatLng | null;
  zoom: number;
  onReady: (map: GoogleMapHandle) => void;
  onMapClick: (event: MapClickEvent) => void;
  onCenterChanged: (point: LatLng) => void;
  onZoomChanged: (zoom: number) => void;
  onError: (error: Error) => void;
};

export function MapPanel({
  mapRef,
  polylines,
  camera,
  zoom,
  onReady,
  onMapClick,
  onCenterChanged,
  onZoomChanged,
  onError,
}: Props) {
  return (
    <section className="maps-test-map-panel" aria-label="지도 및 카메라">
      <GoogleMap
        ref={mapRef}
        center={initialCenter}
        zoom={initialZoom}
        polylines={polylines}
        options={mapOptions}
        onReady={onReady}
        onMapClick={onMapClick}
        onCenterChanged={onCenterChanged}
        onZoomChanged={onZoomChanged}
        onError={onError}
      />
      <section aria-label="Camera">
        <h2>Camera</h2>
        {camera ? (
          <>
            <Coordinates point={camera} />
            <p>zoom: {zoom}</p>
          </>
        ) : (
          <p>지도 준비 대기</p>
        )}
      </section>
    </section>
  );
}
