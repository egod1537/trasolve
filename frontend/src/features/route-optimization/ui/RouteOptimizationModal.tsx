import { useOptimizationModal } from '@/features/route-optimization/model/useOptimizationModal';

import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';

import {
  formatRouteOptimizationIssue,
  TRAVEL_MODE_OPTIONS,
} from '@/features/route-optimization/ui/optimizationSettings';
import { RouteOptimizationProgressDialog } from '@/features/route-optimization/ui/RouteOptimizationProgressDialog';
import { RouteOptimizationFailureDetails } from '@/features/route-optimization/ui/RouteOptimizationFailureDetails';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { TravelModeIcon } from '@/shared/ui/TravelModeIcon';
import { TokenRemainingGauge } from '@/features/billing';
import { OptimizationDepartureOptions } from './OptimizationDepartureOptions';

import { trackEvent } from '@/shared/analytics';
import '@/features/route-optimization/ui/route-optimization.css';
import { type Props } from '@/features/route-optimization/model/optimizationModalTypes';

export function RouteOptimizationModal({
  id,
  days,
  initialDayId,
  onClose,
  onCompare,
}: Props) {
  const state = useOptimizationModal({
    id,
    days,
    initialDayId,
    onClose,
    onCompare,
  });
  if (!state) {
    return null;
  }
  const {
    L,
    titleId,
    validationId,
    controllerRef,
    setDayId,
    running,
    phase,
    setPhase,
    progress,
    error,
    setError,
    day,
    settings,
    issue,
    canAfford,
    changeSettings,
    run,
  } = state;
  return (
    <Dialog
      id={id}
      className="route-settings-popup"
      labelledBy={titleId}
      busy={running}
      closeOnBackdrop={!phase}
      closeOnEscape={!phase}
      onClose={onClose}
    >
      <header className="route-settings-popup-header">
        <h2 id={titleId}>
          {L(
            'routeOptimization:routeOptimizationModal.title.routeOptimization',
          )}
        </h2>
        <IconButton
          aria-label={L(
            'routeOptimization:routeOptimizationModal.ariaLabel.closeRouteOptimization',
          )}
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          disabled={running}
          onClick={onClose}
        />
      </header>
      <div className="route-settings-popup-body">
        <fieldset disabled={running} className="route-settings-day-field">
          <legend>{L('map:layerPanel.ariaLabel.travelItinerary')}</legend>
          <div className="route-settings-day-options">
            {days.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={day.id === item.id}
                title={item.title}
                onFocus={(event) =>
                  event.currentTarget.scrollIntoView({
                    block: 'nearest',
                    inline: 'nearest',
                  })
                }
                onClick={() => {
                  setDayId(item.id);
                  setError(null);
                }}
              >
                <strong>{item.title}</strong>
                <span>
                  {L('map:bottomContextPanel.text.locations', {
                    length: item.places.length,
                  })}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={running}>
          <legend>
            {L(
              'routeOptimization:routeOptimizationModal.optimizationSettings.text.meansTransportation',
            )}
          </legend>
          <div className="route-settings-icon-options route-settings-travel-options">
            {TRAVEL_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={settings.travelMode === option.value}
                onClick={() => changeSettings({ travelMode: option.value })}
              >
                <TravelModeIcon mode={option.value} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={running}>
          <legend>
            {L(
              'routeOptimization:routeOptimizationModal.optimizationSettings.text.startTime',
            )}
          </legend>
          <OptimizationDepartureOptions
            key={day.id}
            settings={settings}
            initialTime={
              [...day.places].sort((a, b) => a.order - b.order)[0]?.time ??
              '09:00'
            }
            onChange={changeSettings}
          />
        </fieldset>
        <TokenRemainingGauge />
        {issue && (
          <p id={validationId} className="route-settings-error" role="alert">
            {formatRouteOptimizationIssue(issue, L)}
          </p>
        )}
        {error && !phase && (
          <div className="route-settings-error" role="alert">
            <p>{error.message}</p>
            <RouteOptimizationFailureDetails
              error={error.trouteError}
              places={day.places}
            />
          </div>
        )}
      </div>
      <footer className="route-settings-popup-actions">
        <Button disabled={running} onClick={onClose}>
          {L('common:action.cancel')}
        </Button>
        <Button
          variant="primary"
          loading={running}
          disabled={Boolean(issue) || running || !canAfford}
          aria-describedby={issue ? validationId : undefined}
          onClick={() => {
            trackEvent({
              eventType: 'button_click',
              screen: ANALYTICS_SCREENS.routeOptimization,
              target: ANALYTICS_TARGETS.optimizeStart,
              metadata: { travelMode: settings.travelMode },
            });
            void run();
          }}
        >
          {L('routeOptimization:routeOptimizationModal.action.optimizationRun')}
        </Button>
      </footer>
      {phase && (
        <RouteOptimizationProgressDialog
          phase={phase}
          progress={progress}
          error={error}
          places={day.places}
          onCancel={() => {
            setPhase('cancelling');
            controllerRef.current?.abort();
          }}
          onClose={() => setPhase(null)}
          onRetry={() => void run()}
        />
      )}
    </Dialog>
  );
}
