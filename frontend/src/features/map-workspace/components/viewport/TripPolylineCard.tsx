import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import type { TripPolylineMode } from '@trasolve/shared';
import type { GeoPoint } from '@/shared/types/mapTypes';
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

type PolylineCardPlace =
  | { name: string; location: GeoPoint }
  | { name: string; location?: GeoPoint; lat: number; lng: number };

type Props = {
  day: { title: string };
  polyline: {
    id: string;
    mode: TripPolylineMode;
    path?: GeoPoint[];
  };
  fromPlace: PolylineCardPlace;
  toPlace: PolylineCardPlace;
  busy: boolean;
  mutationError: string | null;
  readOnly?: boolean;
  groupClassName?: string;
  groupStyle?: CSSProperties;
  layerDetail?: boolean;
  cardRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpdateMode?: (mode: TripPolylineMode) => Promise<boolean>;
};

export type TripPolylineCardHandle = {
  openModeEditor: () => void;
};

function resolveLocation(place: PolylineCardPlace): GeoPoint {
  if ('lat' in place) {
    return place.location ?? { lat: place.lat, lng: place.lng };
  }
  return place.location;
}

export const TripPolylineCard = forwardRef<TripPolylineCardHandle, Props>(
  function TripPolylineCard(
    {
      day,
      polyline,
      fromPlace,
      toPlace,
      busy,
      mutationError,
      readOnly = false,
      groupClassName = 'map-popup-card-group',
      groupStyle,
      layerDetail = false,
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
    const path = polyline.path ?? [
      resolveLocation(fromPlace),
      resolveLocation(toPlace),
    ];
    const distance = formatPolylineDistance(
      calculatePolylineDistanceMeters(path),
      L,
    );
    const closeModeEditor = useCallback(() => setModeEditorOpen(false), []);

    useImperativeHandle(
      ref,
      () => ({
        openModeEditor: () => {
          if (!disabled && !readOnly) {
            setModeEditorOpen(true);
          }
        },
      }),
      [disabled, readOnly],
    );

    const saveMode = async (mode: TripPolylineMode) => {
      if (disabled || readOnly || !onUpdateMode || mode === polyline.mode) {
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
      <div
        ref={groupRef}
        className={groupClassName}
        style={groupStyle}
        data-layer-detail-card={layerDetail || undefined}
      >
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
            readOnly ? undefined : (
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
            )
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

            {!readOnly && (busy || submitting) && (
              <p className="trip-place-saving" role="status">
                {L('map:routeSettingsCard.description.weReSavingWayMoving')}
              </p>
            )}
            {!readOnly && mutationError && (
              <p className="trip-place-mutation-error" role="alert">
                {mutationError}
              </p>
            )}
          </div>
        </MapPopupCardShell>

        {!readOnly && modeEditorOpen && (
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
