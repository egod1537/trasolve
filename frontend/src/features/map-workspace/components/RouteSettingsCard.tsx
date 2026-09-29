import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import type { TripPolyline, TripPolylineMode } from '@trasolve/shared';
import { calculatePolylineDistanceMeters } from '@/features/map-workspace/domain/polylineMetrics';
import {
  createRouteSegmentQuery,
  ROUTABLE_MODES,
  type RouteSegmentState,
} from '@/features/map-workspace/domain/routeSegment';
import {
  formatPolylineMode,
  formatRouteDuration,
} from '@/features/map-workspace/lib/mapFormatters';
import type { TripPlace } from '@/entities/trip';
import { useLayerDetailCardPlacement } from '@/features/map-workspace/components/layer-panel/LayerDetailCard';
import { PolylineModeIcon } from '@/features/map-workspace/components/PolylineModeIcon';
import {
  RouteSegmentItinerary,
  RouteSegmentMetrics,
} from '@/features/map-workspace/components/route-segment/RouteSegmentDetails';
import {
  useRouteSegmentSnapshot,
  useRouteSegmentStore,
} from '@/features/map-workspace/hooks/useRouteSegments';
import { useL, L } from '@/shared/i18n';

const ROUTE_SETTINGS_CARD_WIDTH = 442;

const ROUTE_MODE_ORDER = [
  'straight',
  'walking',
  'transit',
  'driving',
] as const satisfies ReadonlyArray<TripPolylineMode>;

const MODE_DESCRIPTIONS: Record<TripPolylineMode, string> = {
  get straight() {
    return L(
      'map:routeSettingsCard.mODEDESCRIPTIONS.text.straightLineConnectsTwoPlaces',
    );
  },
  get walking() {
    return L('map:routeSettingsCard.mODEDESCRIPTIONS.text.useWalkingRoutes');
  },
  get transit() {
    return L(
      'map:routeSettingsCard.mODEDESCRIPTIONS.text.usePublicTransportationRoutes',
    );
  },
  get driving() {
    return L('map:routeSettingsCard.mODEDESCRIPTIONS.text.useCarTravelRoutes');
  },
};

type RouteModeOptionViewModel = {
  mode: TripPolylineMode;
  label: string;
  durationLabel?: string;
  durationAriaLabel?: string;
  selected: boolean;
};

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

function resolveDurationPresentation(state: RouteSegmentState | undefined): {
  label: string;
  ariaLabel: string;
} {
  if (!state || state.status === 'loading') {
    return {
      label: '…',
      ariaLabel: L(
        'map:routeSettingsCard.resolveDurationPresentation.ariaLabel.viewingEstimatedTime',
      ),
    };
  }
  if (state.status === 'error' || state.detail.durationMillis === null) {
    return {
      label: '—',
      ariaLabel: L(
        'map:routeSettingsCard.resolveDurationPresentation.ariaLabel.noEstimatedTime',
      ),
    };
  }
  const label = formatRouteDuration(state.detail.durationMillis);
  return {
    label,
    ariaLabel: L(
      'map:routeSettingsCard.resolveDurationPresentation.ariaLabel.estimatedTime',
      { label },
    ),
  };
}

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
  const [submitting, setSubmitting] = useState(false);
  const routeSegments = useRouteSegmentStore();
  const routeSnapshot = useRouteSegmentSnapshot();
  const {
    placeId: fromPlaceId,
    lat: fromPlaceLat,
    lng: fromPlaceLng,
  } = fromPlace;
  const { placeId: toPlaceId, lat: toPlaceLat, lng: toPlaceLng } = toPlace;
  const disabled = busy || submitting;
  const placement = useLayerDetailCardPlacement({
    anchorKey,
    sidebarRef,
    onClose,
    width: ROUTE_SETTINGS_CARD_WIDTH,
  });
  const routeQueries = useMemo(() => {
    const from = {
      placeId: fromPlaceId,
      location: { lat: fromPlaceLat, lng: fromPlaceLng },
    };
    const to = {
      placeId: toPlaceId,
      location: { lat: toPlaceLat, lng: toPlaceLng },
    };
    return {
      walking: createRouteSegmentQuery(from, to, 'walking'),
      transit: createRouteSegmentQuery(from, to, 'transit'),
      driving: createRouteSegmentQuery(from, to, 'driving'),
    };
  }, [
    fromPlaceId,
    fromPlaceLat,
    fromPlaceLng,
    toPlaceId,
    toPlaceLat,
    toPlaceLng,
  ]);
  const modeOptions = useMemo<ReadonlyArray<RouteModeOptionViewModel>>(
    () =>
      ROUTE_MODE_ORDER.map((mode) => {
        const duration =
          mode === 'straight'
            ? undefined
            : resolveDurationPresentation(
                routeSnapshot.get(routeQueries[mode].key),
              );
        return {
          mode,
          label: formatPolylineMode(mode, L),
          durationLabel: duration?.label,
          durationAriaLabel: duration?.ariaLabel,
          selected: mode === polyline.mode,
        };
      }),
    [L, polyline.mode, routeQueries, routeSnapshot],
  );
  const selectedQuery =
    polyline.mode === 'straight' ? null : routeQueries[polyline.mode];
  const selectedRoute = selectedQuery
    ? (routeSnapshot.get(selectedQuery.key) ?? { status: 'loading' as const })
    : null;
  const straightDistanceMeters = calculatePolylineDistanceMeters([
    { lat: fromPlaceLat, lng: fromPlaceLng },
    { lat: toPlaceLat, lng: toPlaceLng },
  ]);

  useEffect(() => {
    // Mode comparisons share the session cache with the map geometry.
    for (const mode of ROUTABLE_MODES) {
      routeSegments.ensure(routeQueries[mode]);
    }
  }, [routeQueries, routeSegments]);

  const retrySelectedRoute = useCallback(() => {
    if (selectedQuery) {
      routeSegments.retry(selectedQuery);
    }
  }, [routeSegments, selectedQuery]);

  const selectMode = useCallback(
    async (mode: TripPolylineMode) => {
      if (disabled || mode === polyline.mode) {
        return;
      }
      setSubmitting(true);
      try {
        await onUpdateMode(polyline.id, mode);
      } finally {
        setSubmitting(false);
      }
    },
    [disabled, onUpdateMode, polyline.id, polyline.mode],
  );

  return (
    <aside
      className="route-settings-card"
      style={placement}
      role="dialog"
      aria-label={L('map:routeSettingsCard.ariaLabel.routeSettings')}
      aria-busy={submitting}
      data-layer-detail-card
    >
      <div
        className="route-settings-mode-scroll"
        role="group"
        aria-label={L('map:routeSettingsCard.ariaLabel.chooseMethodTravel')}
      >
        <div className="route-settings-modes">
          {modeOptions.map((option) => (
            <button
              key={option.mode}
              type="button"
              className="route-settings-mode"
              aria-label={
                option.durationAriaLabel
                  ? L('map:routeSettingsCard.ariaLabel.message', {
                      label: option.label,
                      durationAriaLabel: option.durationAriaLabel,
                    })
                  : option.label
              }
              aria-pressed={option.selected}
              disabled={disabled}
              onClick={() => void selectMode(option.mode)}
            >
              <span className="route-settings-mode-primary">
                <PolylineModeIcon mode={option.mode} />
                {option.durationLabel && (
                  <strong>{option.durationLabel}</strong>
                )}
              </span>
              <span className="route-settings-mode-label">{option.label}</span>
              <span
                className="route-settings-mode-indicator"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>

      <section className="route-settings-summary" aria-live="polite">
        <span className="route-settings-summary-icon">
          <PolylineModeIcon mode={polyline.mode} />
        </span>
        <div>
          <strong>{formatPolylineMode(polyline.mode, L)}</strong>
          <p>{MODE_DESCRIPTIONS[polyline.mode]}</p>
        </div>
      </section>

      <section className="route-settings-detail" aria-label="경로 정보">
        <RouteSegmentMetrics
          mode={polyline.mode}
          state={selectedRoute}
          straightDistanceMeters={straightDistanceMeters}
          onRetry={retrySelectedRoute}
        />
        {selectedRoute?.status === 'ready' &&
          selectedRoute.detail.steps.length > 0 && (
            <>
              <h3>경로 상세</h3>
              <RouteSegmentItinerary
                detail={selectedRoute.detail}
                fromName={fromPlace.name}
                toName={toPlace.name}
              />
            </>
          )}
      </section>

      {submitting && (
        <p className="route-settings-status" role="status">
          {L('map:routeSettingsCard.description.weReSavingWayMoving')}
        </p>
      )}
    </aside>
  );
}
