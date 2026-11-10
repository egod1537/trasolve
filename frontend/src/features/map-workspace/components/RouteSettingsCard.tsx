import { type RefObject } from 'react';
import type { TripPolyline, TripPolylineMode } from '@trasolve/shared';
import type { TripPlace } from '@/entities/trip';
import type { QueryRouteDetails } from '../domain/routeDetails';
import { useLayerDetailCardPlacement } from './layer-panel/LayerDetailCard';
import { RouteSettingsPanel } from './RouteSettingsPanel';
import { useL } from '@/shared/i18n';

export function RouteSettingsCard({
  polyline,
  fromPlace,
  toPlace,
  anchorKey,
  busy,
  sidebarRef,
  onQueryRouteDetails,
  onClose,
  onUpdateMode,
}: {
  polyline: TripPolyline;
  fromPlace: TripPlace;
  toPlace: TripPlace;
  anchorKey: string;
  busy: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  onQueryRouteDetails: QueryRouteDetails;
  onClose: () => void;
  onUpdateMode: (
    polylineId: string,
    mode: TripPolylineMode,
  ) => Promise<boolean>;
}) {
  const L = useL();
  const placement = useLayerDetailCardPlacement({
    anchorKey,
    sidebarRef,
    onClose,
    width: 442,
  });
  return (
    <aside
      className="route-settings-card"
      style={placement}
      role="dialog"
      aria-label={L('map:routeSettingsCard.ariaLabel.routeSettings')}
      data-layer-detail-card
    >
      <RouteSettingsPanel
        mode={polyline.mode}
        from={{
          name: fromPlace.name,
          placeId: fromPlace.placeId,
          location: { lat: fromPlace.lat, lng: fromPlace.lng },
        }}
        to={{
          name: toPlace.name,
          placeId: toPlace.placeId,
          location: { lat: toPlace.lat, lng: toPlace.lng },
        }}
        busy={busy}
        onQuery={onQueryRouteDetails}
        onClose={onClose}
        onUpdateMode={(mode) => onUpdateMode(polyline.id, mode)}
      />
    </aside>
  );
}
