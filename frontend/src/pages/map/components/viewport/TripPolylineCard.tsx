import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type {
  TripDay,
  TripPlace,
  TripPolyline,
  TripPolylineMode,
} from '@trasolve/shared';
import { PolylineModeIcon } from '../PolylineModeIcon';
import { PolylineModeOptions } from '../PolylineModeOptions';
import {
  calculatePolylineDistanceMeters,
  formatPolylineDistance,
} from '../../domain/polylineMetrics';
import { formatPolylineMode } from '../../domain/polylineMode';
import { MapPopupCardShell } from './MapPopupCardShell';
import { SideDetailCard } from './SideDetailCard';

type Props = {
  day: TripDay;
  polyline: TripPolyline;
  fromPlace: TripPlace;
  toPlace: TripPlace;
  busy: boolean;
  mutationError: string | null;
  cardRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpdateMode: (mode: TripPolylineMode) => Promise<boolean>;
};

export type TripPolylineCardHandle = {
  openModeEditor: () => void;
};

export const TripPolylineCard = forwardRef<TripPolylineCardHandle, Props>(
  function TripPolylineCard(
    {
      day,
      polyline,
      fromPlace,
      toPlace,
      busy,
      mutationError,
      cardRef,
      onClose,
      onUpdateMode,
    },
    ref,
  ) {
    const [modeEditorOpen, setModeEditorOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const groupRef = useRef<HTMLDivElement>(null);
    const internalMainCardRef = useRef<HTMLElement>(null);
    const mainCardRef = cardRef ?? internalMainCardRef;
    const modeCardId = useId();
    const disabled = busy || submitting;
    const path = polyline.path ?? [fromPlace.location, toPlace.location];
    const distance = formatPolylineDistance(
      calculatePolylineDistanceMeters(path),
    );
    const closeModeEditor = useCallback(() => setModeEditorOpen(false), []);

    useImperativeHandle(
      ref,
      () => ({
        openModeEditor: () => {
          if (!disabled) {
            setModeEditorOpen(true);
          }
        },
      }),
      [disabled],
    );

    const saveMode = async (mode: TripPolylineMode) => {
      if (disabled || mode === polyline.mode) {
        return;
      }
      setSubmitting(true);
      try {
        await onUpdateMode(mode);
      } finally {
        setSubmitting(false);
      }
    };

    const connectionName = `${fromPlace.name} → ${toPlace.name}`;

    return (
      <div ref={groupRef} className="map-popup-card-group">
        <MapPopupCardShell
          cardRef={mainCardRef}
          className="trip-polyline-card"
          title={connectionName}
          subtitle={
            <p className="trip-place-card-position">{day.title} · 이동 구간</p>
          }
          closeLabel="Trip 경로 카드 닫기"
          onClose={onClose}
          headerActionsLayout="stacked-below-close"
          headerActions={
            <button
              type="button"
              className="trip-polyline-mode-trigger"
              aria-label={`이동수단 변경: ${formatPolylineMode(polyline.mode)}`}
              aria-haspopup="dialog"
              aria-expanded={modeEditorOpen}
              aria-controls={modeCardId}
              title={formatPolylineMode(polyline.mode)}
              disabled={disabled}
              onClick={() => setModeEditorOpen((open) => !open)}
            >
              <PolylineModeIcon mode={polyline.mode} />
              <svg
                className="trip-polyline-mode-chevron"
                viewBox="0 0 12 12"
                aria-hidden="true"
              >
                <path d="m3 4.5 3 3 3-3" />
              </svg>
            </button>
          }
        >
          <div className="trip-polyline-card-body">
            <dl className="trip-polyline-details">
              <div>
                <dt>거리</dt>
                <dd>{distance}</dd>
              </div>
              <div>
                <dt>예상 이동시간</dt>
                <dd>경로 계산 전</dd>
              </div>
              <div>
                <dt>메모</dt>
                <dd className="is-empty">설정 안 됨</dd>
              </div>
            </dl>

            {(busy || submitting) && (
              <p className="trip-place-saving" role="status">
                이동 방식을 저장하고 있습니다.
              </p>
            )}
            {mutationError && (
              <p className="trip-place-mutation-error" role="alert">
                {mutationError}
              </p>
            )}
          </div>
        </MapPopupCardShell>

        {modeEditorOpen && (
          <SideDetailCard
            id={modeCardId}
            title="이동 방식"
            groupRef={groupRef}
            mainCardRef={mainCardRef}
            closeLabel="이동 방식 설정 닫기"
            onClose={closeModeEditor}
          >
            <div className="trip-polyline-mode-card-body">
              <PolylineModeOptions
                mode={polyline.mode}
                busy={disabled}
                onSelect={(mode) => void saveMode(mode)}
              />
            </div>
          </SideDetailCard>
        )}
      </div>
    );
  },
);
