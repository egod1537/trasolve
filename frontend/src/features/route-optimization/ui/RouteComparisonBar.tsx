import { useEffect, useId, useRef } from 'react';
import type { RouteComparisonView } from '@/features/route-optimization/model/routeComparison';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { useL } from '@/shared/i18n';
import { ANALYTICS_SCREENS } from '@trasolve/shared';
import { useScreenView } from '@/shared/analytics';
import { getRouteComparisonStyle } from './routeComparisonStyle';
import { RouteComparisonSummary } from './RouteComparisonSummary';

type Props = { comparison: RouteComparisonView };

export function RouteComparisonBar({ comparison }: Props) {
  const L = useL();
  useScreenView(ANALYTICS_SCREENS.routeResult);
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    barRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !comparison.applying &&
        !comparison.confirming &&
        !document.querySelector('.ui-dialog-backdrop:not([hidden])')
      ) {
        event.preventDefault();
        comparison.onExit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [comparison]);
  const error =
    comparison.error ??
    (comparison.stale
      ? L(
          'routeOptimization:routeOptimizationModal.tooltip.itCannotBeAppliedBecauseSchedule',
        )
      : null);
  return (
    <>
      <div className="route-review-layer-positioner">
        <section
          className="route-review-layer-heading"
          style={getRouteComparisonStyle(comparison.mode)}
          aria-label={comparison.data.day.title}
        >
          <svg
            className="route-review-layer-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m12 3 10 6-10 6L2 9Zm-10 10 10 6 10-6M2 17l10 6 10-6" />
          </svg>
          <strong>{comparison.data.day.title}</strong>
          <span>
            {L('map:bottomContextPanel.text.locations', {
              length:
                comparison.mode === 'current'
                  ? comparison.data.day.places.length
                  : comparison.data.update.placeIds.length,
            })}
          </span>
        </section>
      </div>
      <div className="route-review-controls-positioner">
        <section
          ref={barRef}
          tabIndex={-1}
          className="route-review-controls"
          aria-label={L(
            'routeOptimization:routeOptimizationModal.title.pathComparison',
          )}
        >
          <div
            className="route-review-mode-switch"
            role="group"
            aria-label={L(
              'routeOptimization:routeOptimizationModal.title.pathComparison',
            )}
          >
            <button
              type="button"
              style={getRouteComparisonStyle('current')}
              aria-pressed={comparison.mode === 'current'}
              disabled={comparison.applying}
              onClick={() => comparison.onModeChange('current')}
            >
              <span className="route-review-mode-dot" aria-hidden="true" />
              {L(
                'routeOptimization:routeSchedulePreview.beforeSchedule.text.currentSchedule',
              )}
            </button>
            <button
              type="button"
              style={getRouteComparisonStyle('result')}
              aria-pressed={comparison.mode === 'result'}
              disabled={comparison.applying}
              onClick={() => comparison.onModeChange('result')}
            >
              <span className="route-review-mode-dot" aria-hidden="true" />
              {L(
                'routeOptimization:routeSchedulePreview.afterSchedule.text.optimizationSchedule',
              )}
            </button>
          </div>
          {error && (
            <p className="route-review-error" role="alert">
              {error}
            </p>
          )}
          <div className="route-review-control-row">
            <div className="route-review-day-copy">
              <strong>{comparison.data.day.title}</strong>
              <span>
                {L('map:bottomContextPanel.text.locations', {
                  length: comparison.data.day.places.length,
                })}
              </span>
            </div>
            <div className="route-review-actions">
              <Button
                disabled={comparison.applying}
                onClick={comparison.onExit}
              >
                {L('common:action.close')}
              </Button>
              <Button
                variant="primary"
                loading={comparison.applying}
                disabled={comparison.applying || comparison.stale}
                onClick={comparison.onApply}
              >
                {L(
                  'routeOptimization:routeOptimizationModal.action.applyThisResult',
                )}
              </Button>
            </div>
          </div>
        </section>
      </div>
      {comparison.confirming && (
        <RouteApplyConfirmation comparison={comparison} error={error} />
      )}
    </>
  );
}

function RouteApplyConfirmation({
  comparison,
  error,
}: Props & { error: string | null }) {
  const L = useL();
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      className="route-apply-confirmation"
      role="alertdialog"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={cancelRef}
      busy={comparison.applying}
      closeOnBackdrop={!comparison.applying}
      closeOnEscape={!comparison.applying}
      onClose={comparison.onCancelApply}
    >
      <h2 id={titleId}>
        {L('routeOptimization:routeOptimizationModal.action.applyThisResult')}
      </h2>
      <div id={descriptionId} className="route-apply-confirmation-summary">
        <strong>{comparison.data.day.title}</strong>
        <span>
          {L('map:bottomContextPanel.text.locations', {
            length: comparison.data.update.placeIds.length,
          })}
        </span>
        <p className="route-apply-confirmation-change">
          {L(
            'routeOptimization:routeSchedulePreview.beforeSchedule.text.currentSchedule',
          )}
          <span aria-hidden="true">→</span>
          {L(
            'routeOptimization:routeSchedulePreview.afterSchedule.text.optimizationSchedule',
          )}
        </p>
      </div>
      <RouteComparisonSummary data={comparison.data} compact />
      {error && (
        <p role="alert" className="route-review-error">
          {error}
        </p>
      )}
      <footer className="route-review-actions">
        <Button
          ref={cancelRef}
          disabled={comparison.applying}
          onClick={comparison.onCancelApply}
        >
          {L('common:action.cancel')}
        </Button>
        <Button
          variant="primary"
          loading={comparison.applying}
          disabled={comparison.applying || comparison.stale}
          onClick={comparison.onConfirmApply}
        >
          {L('common:action.apply')}
        </Button>
      </footer>
    </Dialog>
  );
}
