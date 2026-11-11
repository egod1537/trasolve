import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useState, type CSSProperties, type RefObject } from 'react';
import type { TripPolylineMode } from '@trasolve/shared';
import type { QueryRouteDetails, RouteEndpoint } from '../domain/routeDetails';
import { useRouteOptions } from '../model/useRouteOptions';
import { RouteModeTabs, formatRouteFailure } from './RouteModeTabs';
import { RouteResults } from './RouteResults';
import { PolylineModeIcon } from './PolylineModeIcon';
import { getLanguage, useL } from '@/shared/i18n';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';

export function RouteSettingsPanel({
  mode,
  from,
  to,
  busy,
  mutationError,
  readOnly = false,
  deferUntilReady = false,
  onQuery,
  onUpdateMode,
  onClose,
  surfaceClassName,
  surfaceStyle,
  cardRef,
  layerDetail,
}: {
  mode: TripPolylineMode;
  from: RouteEndpoint;
  to: RouteEndpoint;
  busy: boolean;
  mutationError?: string | null;
  readOnly?: boolean;
  deferUntilReady?: boolean;
  onQuery: QueryRouteDetails;
  onUpdateMode?: (mode: TripPolylineMode) => Promise<boolean>;
  onClose: () => void;
  surfaceClassName?: string;
  surfaceStyle?: CSSProperties;
  cardRef?: RefObject<HTMLElement | null>;
  layerDetail?: boolean;
}) {
  const L = useL();
  const { states, key, settled } = useRouteOptions(
    from,
    to,
    getLanguage(),
    onQuery,
  );
  const [submitting, setSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(mode);
  const activeMode = readOnly ? previewMode : mode;
  const selected = activeMode === 'straight' ? null : states[activeMode];
  const selectMode = async (next: TripPolylineMode) => {
    if (readOnly) {
      setPreviewMode(next);
      return;
    }
    if (busy || submitting || mode === next || !onUpdateMode) {
      return;
    }
    setSubmitting(true);
    try {
      await onUpdateMode(next);
    } finally {
      setSubmitting(false);
    }
  };
  if (deferUntilReady && !settled) {
    return null;
  }
  return (
    <section
      ref={cardRef}
      tabIndex={-1}
      className={`route-settings-panel ${surfaceClassName ?? ''}`}
      style={surfaceStyle}
      role={surfaceClassName ? 'dialog' : undefined}
      aria-label={L('map:routeSettingsCard.ariaLabel.routeSettings')}
      data-layer-detail-card={layerDetail || undefined}
    >
      <header className="route-settings-endpoints">
        <div>
          <span>
            {L(
              'testbed:jobResultMapComparison.locationSequence.label.departure',
            )}
          </span>
          <strong>{from.name}</strong>
          <span>
            {L('testbed:jobResultMapComparison.locationSequence.label.arrival')}
          </span>
          <strong>{to.name}</strong>
        </div>
        <IconButton
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          aria-label={L('common:action.close')}
          disabled={submitting}
          onClick={onClose}
        />
      </header>
      <RouteModeTabs
        mode={activeMode}
        states={states}
        disabled={busy || submitting}
        onSelect={(next) => void selectMode(next)}
      />
      <ScrollArea
        className="route-settings-body"
        key={`${key}:${activeMode}`}
        contentClassName="route-settings-body-content"
        viewportProps={{
          role: 'region',
          tabIndex: 0,
          'aria-label': L(
            'testbed:routeResultPanel.ariaLabel.directionsResults',
          ),
        }}
      >
        {activeMode === 'straight' ? (
          <div className="route-settings-summary">
            <span className="route-settings-summary-icon">
              <PolylineModeIcon mode="straight" />
            </span>
            <p>
              {L(
                'map:routeSettingsCard.mODEDESCRIPTIONS.text.straightLineConnectsTwoPlaces',
              )}
            </p>
          </div>
        ) : selected?.status === 'ready' ? (
          <RouteResults
            key={`${key}:${activeMode}`}
            routes={selected.routes}
            mode={activeMode}
            from={from}
            to={to}
          />
        ) : (
          <p
            className="route-settings-state"
            role="status"
            data-error-code={
              selected?.status === 'error' ? selected.failure.code : undefined
            }
          >
            {selected?.status === 'error'
              ? formatRouteFailure(selected.failure, L)
              : L(
                  'map:routeSettingsCard.resolveDurationPresentation.ariaLabel.viewingEstimatedTime',
                )}
          </p>
        )}
        {submitting && (
          <p className="route-settings-state" role="status">
            {L('map:routeSettingsCard.description.weReSavingWayMoving')}
          </p>
        )}
        {mutationError && (
          <p className="route-settings-state is-error" role="alert">
            {mutationError}
          </p>
        )}
      </ScrollArea>
    </section>
  );
}
