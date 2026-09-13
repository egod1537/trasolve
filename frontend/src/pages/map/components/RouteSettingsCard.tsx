import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import {
  TravelMode,
  type RouteLocation,
  type TripPolyline,
  type TripPolylineMode,
} from '@trasolve/shared';
import { formatPolylineMode } from '../domain/polylineMode';
import {
  formatRouteDuration,
  type QueryRouteDuration,
} from '../domain/routeDuration';
import type { TripPlace } from '../domain/trip';
import { useLayerDetailCardPlacement } from './layer-panel/LayerDetailCard';
import { PolylineModeIcon } from './PolylineModeIcon';

const ROUTE_SETTINGS_CARD_WIDTH = 442;

const ROUTE_MODE_ORDER = [
  'straight',
  'walking',
  'transit',
  'driving',
] as const satisfies ReadonlyArray<TripPolylineMode>;

const ROUTABLE_MODES = [
  'walking',
  'transit',
  'driving',
] as const satisfies ReadonlyArray<RoutableMode>;

const TRAVEL_MODE_BY_POLYLINE_MODE: Record<RoutableMode, TravelMode> = {
  walking: TravelMode.WALKING,
  transit: TravelMode.TRANSIT,
  driving: TravelMode.DRIVING,
};

const MODE_DESCRIPTIONS: Record<TripPolylineMode, string> = {
  straight: '두 장소를 직선으로 연결합니다.',
  walking: '도보 이동 경로를 사용합니다.',
  transit: '대중교통 경로를 사용합니다.',
  driving: '자동차 이동 경로를 사용합니다.',
};

type RouteModeOptionViewModel = {
  mode: TripPolylineMode;
  label: string;
  durationLabel?: string;
  durationAriaLabel?: string;
  selected: boolean;
};

type RoutableMode = Exclude<TripPolylineMode, 'straight'>;

type DurationState =
  | { status: 'loading' }
  | { status: 'ready'; label: string }
  | { status: 'error' };

type DurationStates = Record<RoutableMode, DurationState>;

const INITIAL_DURATION_STATES: DurationStates = {
  walking: { status: 'loading' },
  transit: { status: 'loading' },
  driving: { status: 'loading' },
};

type Props = {
  polyline: TripPolyline;
  fromPlace: TripPlace;
  toPlace: TripPlace;
  anchorKey: string;
  busy: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  onQueryRouteDuration: QueryRouteDuration;
  onClose: () => void;
  onUpdateMode: (
    polylineId: string,
    mode: TripPolylineMode,
  ) => Promise<boolean>;
};

function resolveRouteLocation(
  placeId: string | undefined,
  lat: number,
  lng: number,
): RouteLocation {
  if (placeId) {
    return { type: 'place', placeId };
  }
  return { type: 'coordinates', lat, lng };
}

function resolveDurationPresentation(state: DurationState): {
  label: string;
  ariaLabel: string;
} {
  if (state.status === 'loading') {
    return { label: '…', ariaLabel: '예상 시간 조회 중' };
  }
  if (state.status === 'error') {
    return { label: '—', ariaLabel: '예상 시간 없음' };
  }
  return { label: state.label, ariaLabel: `예상 시간 ${state.label}` };
}

export function RouteSettingsCard({
  polyline,
  fromPlace,
  toPlace,
  anchorKey,
  busy,
  sidebarRef,
  onQueryRouteDuration,
  onClose,
  onUpdateMode,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [durationStates, setDurationStates] = useState<DurationStates>(
    INITIAL_DURATION_STATES,
  );
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
  const modeOptions = useMemo<ReadonlyArray<RouteModeOptionViewModel>>(
    () =>
      ROUTE_MODE_ORDER.map((mode) => {
        const duration =
          mode === 'straight'
            ? undefined
            : resolveDurationPresentation(durationStates[mode]);
        return {
          mode,
          label: formatPolylineMode(mode),
          durationLabel: duration?.label,
          durationAriaLabel: duration?.ariaLabel,
          selected: mode === polyline.mode,
        };
      }),
    [durationStates, polyline.mode],
  );

  useEffect(() => {
    const request = new AbortController();
    const origin = resolveRouteLocation(
      fromPlaceId,
      fromPlaceLat,
      fromPlaceLng,
    );
    const destination = resolveRouteLocation(toPlaceId, toPlaceLat, toPlaceLng);

    void Promise.allSettled(
      ROUTABLE_MODES.map(async (mode) => {
        try {
          const durationMillis = await onQueryRouteDuration(
            {
              origin,
              destination,
              travelMode: TRAVEL_MODE_BY_POLYLINE_MODE[mode],
            },
            request.signal,
          );
          if (request.signal.aborted) {
            return;
          }

          setDurationStates((current) => ({
            ...current,
            [mode]:
              durationMillis === null || durationMillis === undefined
                ? { status: 'error' }
                : {
                    status: 'ready',
                    label: formatRouteDuration(durationMillis),
                  },
          }));
        } catch {
          if (request.signal.aborted) {
            return;
          }
          setDurationStates((current) => ({
            ...current,
            [mode]: { status: 'error' },
          }));
        }
      }),
    );

    return () => request.abort();
  }, [
    fromPlaceId,
    fromPlaceLat,
    fromPlaceLng,
    onQueryRouteDuration,
    toPlaceId,
    toPlaceLat,
    toPlaceLng,
  ]);

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
      aria-label="경로 설정"
      aria-busy={submitting}
      data-layer-detail-card
    >
      <div
        className="route-settings-mode-scroll"
        role="group"
        aria-label="이동 방식 선택"
      >
        <div className="route-settings-modes">
          {modeOptions.map((option) => (
            <button
              key={option.mode}
              type="button"
              className="route-settings-mode"
              aria-label={
                option.durationAriaLabel
                  ? `${option.label}, ${option.durationAriaLabel}`
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
          <strong>{formatPolylineMode(polyline.mode)}</strong>
          <p>{MODE_DESCRIPTIONS[polyline.mode]}</p>
        </div>
      </section>

      {submitting && (
        <p className="route-settings-status" role="status">
          이동 방식을 저장하고 있습니다.
        </p>
      )}
    </aside>
  );
}
