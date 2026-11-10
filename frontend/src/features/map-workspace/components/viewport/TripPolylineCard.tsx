import type { CSSProperties, RefObject } from 'react';
import type { TripPolylineMode } from '@trasolve/shared';
import type { GeoPoint } from '@/shared/types/mapTypes';
import type { RouteEndpoint } from '../../domain/routeDetails';
import { queryRouteDetails } from '../../api/routeDetails';
import { RouteSettingsPanel } from '../RouteSettingsPanel';

type CardPlace = { name: string; placeId?: string } & (
  { location: GeoPoint } | { location?: GeoPoint; lat: number; lng: number }
);
function endpoint(place: CardPlace): RouteEndpoint {
  const location =
    'lat' in place
      ? (place.location ?? { lat: place.lat, lng: place.lng })
      : place.location;
  return { name: place.name, placeId: place.placeId, location };
}

export function TripPolylineCard({
  polyline,
  fromPlace,
  toPlace,
  busy,
  mutationError,
  readOnly = false,
  groupClassName = '',
  groupStyle,
  layerDetail = false,
  cardRef,
  onClose,
  onUpdateMode,
}: {
  day: { title: string };
  polyline: { id: string; mode: TripPolylineMode; path?: GeoPoint[] };
  fromPlace: CardPlace;
  toPlace: CardPlace;
  busy: boolean;
  mutationError: string | null;
  readOnly?: boolean;
  groupClassName?: string;
  groupStyle?: CSSProperties;
  layerDetail?: boolean;
  cardRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpdateMode?: (mode: TripPolylineMode) => Promise<boolean>;
}) {
  return (
    <RouteSettingsPanel
      key={polyline.id}
      surfaceClassName={`route-settings-card ${layerDetail ? '' : 'is-map-route-card'} ${groupClassName}`}
      surfaceStyle={groupStyle}
      cardRef={cardRef}
      layerDetail={layerDetail}
      mode={polyline.mode}
      from={endpoint(fromPlace)}
      to={endpoint(toPlace)}
      busy={busy}
      mutationError={mutationError}
      readOnly={readOnly}
      deferUntilReady={!layerDetail}
      onQuery={queryRouteDetails}
      onUpdateMode={onUpdateMode}
      onClose={onClose}
    />
  );
}
