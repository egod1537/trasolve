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
import { PolylineModeIcon } from '@/features/map-workspace/components/PolylineModeIcon';
import { PolylineModeOptions } from '@/features/map-workspace/components/PolylineModeOptions';
import { calculatePolylineDistanceMeters } from '@/features/map-workspace/domain/polylineMetrics';
import {
  formatPolylineDistance,
  formatPolylineMode,
} from '@/features/map-workspace/lib/mapFormatters';
import { MapPopupCardShell } from '@/shared/ui/map/MapPopupCardShell';
import { SideDetailCard } from '@/shared/ui/map/SideDetailCard';
import { useL } from '@/shared/i18n';

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
    const L = useL();
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
      L,
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
            <p className="trip-place-card-position">
              {L('map:tripPolylineCard.text.movementSection', {
                title: day.title,
              })}
            </p>
          }
          closeLabel={L('map:tripPolylineCard.text.closeTripRouteCard')}
          onClose={onClose}
          headerActionsLayout="stacked-below-close"
          headerActions={
            <button
              type="button"
              className="trip-polyline-mode-trigger"
              aria-label={L(
                'map:tripPolylineCard.ariaLabel.changeModeTransportation',
                { formatPolylineMode: formatPolylineMode(polyline.mode, L) },
              )}
              aria-haspopup="dialog"
              aria-expanded={modeEditorOpen}
              aria-controls={modeCardId}
              title={formatPolylineMode(polyline.mode, L)}
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
                <dt>{L('map:tripPolylineCard.label.distance')}</dt>
                <dd>{distance}</dd>
              </div>
              <div>
                <dt>{L('map:tripPolylineCard.label.estimatedTravelTime')}</dt>
                <dd>{L('map:tripPolylineCard.text.beforeRouteCalculation')}</dd>
              </div>
              <div>
                <dt>{L('map:tripPolylineCard.label.memo')}</dt>
                <dd className="is-empty">
                  {L('map:tripPolylineCard.text.notSet')}
                </dd>
              </div>
            </dl>

            {(busy || submitting) && (
              <p className="trip-place-saving" role="status">
                {L('map:routeSettingsCard.description.weReSavingWayMoving')}
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
            title={L('map:tripPolylineCard.tooltip.wayMoving')}
            groupRef={groupRef}
            mainCardRef={mainCardRef}
            closeLabel={L(
              'map:tripPolylineCard.text.closeTravelMethodSettings',
            )}
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
