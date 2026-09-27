import type { LatLng } from '@/map/types/googleMapComponent';
import { NL } from '@/shared/i18n';

export function Coordinates({ point }: { point: LatLng }) {
  return (
    <dl className="maps-test-data maps-test-coordinates">
      <dt>{NL('latitude')}</dt>
      <dd>{point.lat}</dd>
      <dt>{NL('longitude')}</dt>
      <dd>{point.lng}</dd>
    </dl>
  );
}
