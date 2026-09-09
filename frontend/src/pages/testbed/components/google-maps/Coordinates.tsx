import type { LatLng } from '../../../../map/types/googleMapComponent';

export function Coordinates({ point }: { point: LatLng }) {
  return (
    <dl className="maps-test-data maps-test-coordinates">
      <dt>latitude</dt>
      <dd>{point.lat}</dd>
      <dt>longitude</dt>
      <dd>{point.lng}</dd>
    </dl>
  );
}
