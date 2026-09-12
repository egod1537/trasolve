import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import type { TripPolyline, TripPolylineMode } from '@trasolve/shared';
import { formatPolylineMode } from '../domain/polylineMode';
import { useLayerDetailCardPlacement } from './layer-panel/LayerDetailCard';
import { PolylineModeIcon } from './PolylineModeIcon';

const CLOSE_ANIMATION_MS = 180;
const ROUTE_SETTINGS_CARD_WIDTH = 442;

const ROUTE_MODE_ORDER = [
  'driving',
  'transit',
  'walking',
  'straight',
] as const satisfies ReadonlyArray<TripPolylineMode>;

const MODE_DESCRIPTIONS: Record<TripPolylineMode, string> = {
  straight: '두 장소를 직선으로 연결합니다.',
  walking: '도보 이동 경로를 사용합니다.',
  transit: '대중교통 경로를 사용합니다.',
  driving: '자동차 이동 경로를 사용합니다.',
};

type RouteModeOptionViewModel = {
  mode: TripPolylineMode;
  label: string;
  durationLabel: string;
  selected: boolean;
};

type Props = {
  polyline: TripPolyline;
  anchorKey: string;
  busy: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpdateMode: (
    polylineId: string,
    mode: TripPolylineMode,
  ) => Promise<boolean>;
};

export function RouteSettingsCard({
  polyline,
  anchorKey,
  busy,
  sidebarRef,
  onClose,
  onUpdateMode,
}: Props) {
  const [closing, setClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const disabled = busy || submitting || closing;
  const placement = useLayerDetailCardPlacement({
    anchorKey,
    sidebarRef,
    onClose,
    width: ROUTE_SETTINGS_CARD_WIDTH,
  });
  const modeOptions = useMemo<ReadonlyArray<RouteModeOptionViewModel>>(
    () =>
      ROUTE_MODE_ORDER.map((mode) => ({
        mode,
        label: formatPolylineMode(mode),
        durationLabel: '—',
        selected: mode === polyline.mode,
      })),
    [polyline.mode],
  );

  useEffect(() => {
    if (!closing) {
      return;
    }

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const timeoutId = window.setTimeout(
      onClose,
      reducedMotion ? 0 : CLOSE_ANIMATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [closing, onClose]);

  const requestClose = useCallback(() => {
    if (!closing) {
      setClosing(true);
    }
  }, [closing]);

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
      className={`route-settings-card${closing ? ' is-closing' : ''}`}
      style={placement}
      role="dialog"
      aria-label="경로 설정"
      aria-busy={submitting}
      data-layer-detail-card
    >
      <div className="route-settings-card-actions">
        <button
          type="button"
          aria-label="경로 옵션"
          title="경로 옵션 기능 준비 중"
          disabled
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="경로 공유"
          title="경로 공유 기능 준비 중"
          disabled
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.5m-7.6 6.9 7.6 4.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="경로 설정 닫기"
          title="닫기"
          onClick={requestClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

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
              aria-label={`${option.label}, 예상 시간 ${option.durationLabel}`}
              aria-pressed={option.selected}
              disabled={disabled}
              onClick={() => void selectMode(option.mode)}
            >
              <span className="route-settings-mode-primary">
                <PolylineModeIcon mode={option.mode} />
                <strong>{option.durationLabel}</strong>
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
