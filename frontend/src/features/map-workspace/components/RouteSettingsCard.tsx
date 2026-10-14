import { useCallback, type RefObject } from 'react';
import type { TripPolyline, TripPolylineMode } from '@trasolve/shared';
import type { TripPlace } from '@/entities/trip';
import { useLayerDetailCardPlacement } from '@/features/map-workspace/components/layer-panel/LayerDetailCard';
import { RouteCandidatePanel } from '@/features/map-workspace/components/route-segment/RouteCandidatePanel';
import { useL } from '@/shared/i18n';

const ROUTE_SETTINGS_CARD_WIDTH = 460;

type Props = {
  polyline: TripPolyline;
  fromPlace: TripPlace;
  toPlace: TripPlace;
  anchorKey: string;
  busy: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpdateMode: (
    polylineId: string,
    mode: TripPolylineMode,
  ) => Promise<boolean>;
};

/** Sidebar detail panel of one travel segment: route candidate comparison. */
export function RouteSettingsCard({
  polyline,
  fromPlace,
  toPlace,
  anchorKey,
  busy,
  sidebarRef,
  onClose,
  onUpdateMode,
}: Props) {
  const L = useL();
  const placement = useLayerDetailCardPlacement({
    anchorKey,
    sidebarRef,
    onClose,
    width: ROUTE_SETTINGS_CARD_WIDTH,
  });
  const updateMode = useCallback(
    (mode: TripPolylineMode) => onUpdateMode(polyline.id, mode),
    [onUpdateMode, polyline.id],
  );

  return (
    <aside
      className="route-settings-card"
      style={placement}
      role="dialog"
      aria-label={L('map:routeSettingsCard.ariaLabel.routeSettings')}
      aria-busy={busy}
      data-layer-detail-card
    >
      <RouteCandidatePanel
        polylineMode={polyline.mode}
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
        disabled={busy}
        onUpdateMode={updateMode}
      />
    </aside>
  );
}
