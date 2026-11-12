import { useRef, useState } from 'react';
import { useLayoutMaxWidth } from '@/shared/hooks/useLayoutMaxWidth';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useOptimizationModal } from '@/features/route-optimization/model/useOptimizationModal';

import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';

import { RouteOptimizationProgressDialog } from '@/features/route-optimization/ui/RouteOptimizationProgressDialog';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { TokenCostSummary, TokenRemainingGauge } from '@/features/billing';
import { OptimizationSettingsFields } from './OptimizationSettingsFields';
import {
  OptimizationMobileTabs,
  type OptimizationMobileTab,
} from './OptimizationMobileTabs';
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
  const mobile = useLayoutMaxWidth();
  const [tab, setTab] = useState<OptimizationMobileTab>('settings');
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
    cached,
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
            <div className="route-settings-wallet">
              <TokenRemainingGauge />
              <TokenCostSummary
                placeCount={day.places.length}
                cached={cached}
              />
            </div>
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
        {mobile && (
          <OptimizationMobileTabs
            id={titleId}
            selected={tab}
            attention={
              validation.blocksOptimization ||
              Boolean(validation.error || error)
            }
            onSelect={setTab}
          />
        )}
        <ScrollArea
          className="route-settings-popup-body"
          contentClassName="route-settings-popup-body-content"
          hidden={mobile && tab !== 'settings'}
          viewportProps={
            mobile
              ? {
                  id: `${titleId}-panel-settings`,
                  role: 'tabpanel',
                  'aria-labelledby': `${titleId}-tab-settings`,
                }
              : undefined
          }
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
          <OptimizationSettingsFields
            day={day}
            settings={settings}
            disabled={running}
            onChange={changeSettings}
          />
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
          hidden={mobile && tab !== 'validation'}
          panelId={mobile ? `${titleId}-panel-validation` : undefined}
          tabId={mobile ? `${titleId}-tab-validation` : undefined}
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
