import type { RefObject } from 'react';
import { GoogleMap } from '@/map/components/GoogleMap';
import type {
  GoogleMapHandle,
  MapClickEvent,
  MapPolyline,
  LatLng,
} from '@/map/types/googleMapComponent';
import { Coordinates } from '@/pages/testbed/components/google-maps/Coordinates';
import {
  initialCenter,
  initialZoom,
  mapOptions,
} from '@/pages/testbed/components/google-maps/config';
import { useL } from '@/shared/i18n';

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
  const L = useL();
  return (
    <section
      className="maps-test-map-panel"
      aria-label={L('testbed:mapPanel.ariaLabel.mapsCameras')}
    >
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
      <section aria-label={L('testbed:mapPanel.label.camera')}>
        <h2>{L('testbed:mapPanel.label.camera')}</h2>
        {camera ? (
          <>
            <Coordinates point={camera} />
            <p>
              {L('testbed:mapPanel.description.zoom')}
              {zoom}
            </p>
          </>
        ) : (
          <p>{L('testbed:mapPanel.description.waitingMapBeReady')}</p>
        )}
      </section>
    </section>
  );
}
