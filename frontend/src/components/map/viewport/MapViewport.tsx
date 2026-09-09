import type { ComponentProps } from 'react';
import { GoogleMapView } from '../GoogleMapView';
import { MapToolbar } from '../MapToolbar';

type Props = ComponentProps<typeof GoogleMapView> & { aiOpen: boolean };

export function MapViewport({ aiOpen, ...mapProps }: Props) {
  return (
    <div className="map-viewport">
      <GoogleMapView {...mapProps} />
      <div className="map-viewport-tools">
        <MapToolbar aiOpen={aiOpen} />
      </div>
    </div>
  );
}
