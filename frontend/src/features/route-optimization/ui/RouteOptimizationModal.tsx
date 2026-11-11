import { useRef, useState } from 'react';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useOptimizationModal } from '@/features/route-optimization/model/useOptimizationModal';

import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';

import { TRAVEL_MODE_OPTIONS } from '@/features/route-optimization/ui/optimizationSettings';
import { RouteOptimizationProgressDialog } from '@/features/route-optimization/ui/RouteOptimizationProgressDialog';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { TravelModeIcon } from '@/shared/ui/TravelModeIcon';
import { TokenRemainingGauge } from '@/features/billing';
import { OptimizationDepartureOptions } from './OptimizationDepartureOptions';
import { OptimizationDaySelector } from './OptimizationDaySelector';
import { OptimizationValidationPanel } from './OptimizationValidationPanel';

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
  const settingsPopupRef = useRef<HTMLDivElement>(null);
  const [dayPopoverHost, setDayPopoverHost] = useState<HTMLDivElement | null>(
    null,
  );
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
    validation,
    canAfford,
    changeSettings,
    run,
  } = state;
  return (
    <Dialog
      id={id}
      className="route-settings-dialog"
      backdropClassName="route-settings-backdrop"
      labelledBy={titleId}
      busy={running}
      closeOnBackdrop={!phase}
      closeOnEscape={!phase}
      onClose={onClose}
    >
      <div ref={settingsPopupRef} className="route-settings-popup">
        <header className="route-settings-popup-header">
          <h2 id={titleId}>
            {L(
              'routeOptimization:routeOptimizationModal.title.routeOptimization',
            )}
          </h2>
          <div className="route-settings-popup-header-actions">
            <TokenRemainingGauge />
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
          </div>
        </header>
        <ScrollArea
          className="route-settings-popup-body"
          contentClassName="route-settings-popup-body-content"
        >
          <OptimizationDaySelector
            popupContainer={dayPopoverHost}
            anchorRef={settingsPopupRef}
            days={days}
            day={day}
            disabled={running}
            onSelect={(dayId) => {
              setDayId(dayId);
              setError(null);
            }}
          />
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
        </ScrollArea>
        <footer className="route-settings-popup-actions">
          <Button disabled={running} onClick={onClose}>
            {L('common:action.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={running}
            disabled={validation.blocksOptimization || running || !canAfford}
            aria-describedby={
              issue || validation.result?.issues.length
                ? validationId
                : undefined
            }
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
            {L(
              'routeOptimization:routeOptimizationModal.action.optimizationRun',
            )}
          </Button>
        </footer>
      </div>
      <div ref={setDayPopoverHost} className="route-settings-day-portal" />
      {!phase && (
        <OptimizationValidationPanel
          key={day.id}
          id={validationId}
          day={day}
          validation={validation}
          error={error}
        />
      )}
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
