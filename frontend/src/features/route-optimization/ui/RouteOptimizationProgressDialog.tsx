import { useEffect, useId, useRef, type RefObject } from 'react';
import { RouteOptimizationFailureDetails } from '@/features/route-optimization/ui/RouteOptimizationFailureDetails';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { Progress } from '@/shared/ui/Progress';
import { useL } from '@/shared/i18n';
import {
  type RouteOptimizationProgressPhase,
  type Props,
  PROGRESS_STEPS,
  type StepState,
  getTitle,
  getMessage,
  getStepState,
  getCurrentStepState,
  getProgressStepIndex,
  getProgressTone,
  formatStepState,
  formatServerStatus,
} from '@/features/route-optimization/ui/optimizationProgressPresentation';
export { type RouteOptimizationProgressPhase } from '@/features/route-optimization/ui/optimizationProgressPresentation';

export function RouteOptimizationProgressDialog({
  phase,
  progress,
  error,
  places,
  onCancel,
  onClose,
  onRetry,
}: Props) {
  const L = useL();
  const titleId = useId();
  const descriptionId = useId();
  const currentStepRef = useRef<HTMLLIElement>(null);
  const terminal =
    phase === 'completed' || phase === 'failed' || phase === 'cancelled';
  const active =
    phase === 'submitting' || phase === 'running' || phase === 'cancelling';
  const percentage = phase === 'completed' ? 100 : progress?.progress;
  const showMeter = active || percentage !== undefined;
  const stage = progress?.stage ?? null;
  const unknownStage =
    phase !== 'completed' && stage !== null && getProgressStepIndex(stage) < 0;

  useEffect(() => {
    currentStepRef.current?.scrollIntoView({ block: 'nearest' });
  }, [phase, stage]);

  return (
    <Dialog
      className={`route-optimization-progress-dialog is-${phase}`}
      backdropClassName="route-optimization-progress-backdrop"
      labelledBy={titleId}
      describedBy={descriptionId}
      busy={!terminal}
      closeOnBackdrop={false}
      closeOnEscape={terminal}
      onClose={terminal ? onClose : () => undefined}
    >
      <div className="route-optimization-progress-content">
        <header>
          <h2 id={titleId}>{getTitle(phase)}</h2>
          <p id={descriptionId} aria-live="polite">
            {getMessage(phase, progress)}
          </p>
        </header>

        {phase === 'failed' ? (
          <div className="route-optimization-progress-error" role="alert">
            <strong>
              {L(
                'routeOptimization:routeOptimizationApi.formatOptimizationJobError.text.pathOptimizationFailed',
              )}
            </strong>
            <p>
              {error?.message ??
                L(
                  'routeOptimization:routeOptimizationProgressDialog.description.routeOptimizationRequestCouldNotBe',
                )}
            </p>
            <RouteOptimizationFailureDetails
              error={error?.trouteError ?? null}
              places={places}
            />
          </div>
        ) : null}

        {showMeter ? (
          <div className="route-optimization-progress-meter">
            <Progress
              value={percentage}
              tone={getProgressTone(phase)}
              animated={active}
              label={
                percentage === undefined
                  ? L(
                      'routeOptimization:routeOptimizationProgressDialog.text.routeOptimizationProgress',
                    )
                  : L(
                      'routeOptimization:routeOptimizationProgressDialog.text.routeOptimizationProgress2',
                      { percentage: percentage },
                    )
              }
            />
            <span>
              {percentage === undefined
                ? ''
                : L(
                    'routeOptimization:routeOptimizationProgressDialog.text.message',
                    { percentage: percentage },
                  )}
            </span>
          </div>
        ) : null}

        <ol
          className="route-optimization-progress-steps"
          aria-label={L(
            'routeOptimization:routeOptimizationProgressDialog.ariaLabel.pathOptimizationPhase',
          )}
          tabIndex={0}
        >
          {PROGRESS_STEPS.map((step, index) => {
            const state = getStepState(phase, stage, index);
            return (
              <ProgressStep
                key={step.stage}
                label={step.label}
                state={state}
                phase={phase}
                currentStepRef={currentStepRef}
              />
            );
          })}
          {unknownStage ? (
            <ProgressStep
              label={L(
                'routeOptimization:routeOptimizationProgressDialog.text.processing',
              )}
              state={getCurrentStepState(phase)}
              phase={phase}
              currentStepRef={currentStepRef}
            />
          ) : null}
        </ol>

        {progress && phase !== 'cancelled' ? (
          <p className="route-optimization-progress-server-status">
            {L(
              'routeOptimization:routeOptimizationProgressDialog.text.serverStatus',
              { status: formatServerStatus(progress.status) },
            )}
          </p>
        ) : null}
      </div>

      <footer className="route-optimization-progress-actions">
        {phase === 'failed' ? (
          <>
            <Button onClick={onClose}>{L('common:action.close')}</Button>
            <Button variant="primary" onClick={onRetry}>
              {L('common:action.retry')}
            </Button>
          </>
        ) : phase === 'cancelled' ? (
          <Button variant="primary" onClick={onClose}>
            {L('common:action.close')}
          </Button>
        ) : phase === 'completed' ? null : (
          <Button
            loading={phase === 'cancelling'}
            disabled={phase === 'cancelling'}
            onClick={onCancel}
          >
            {phase === 'cancelling'
              ? L(
                  'routeOptimization:routeOptimizationProgressDialog.action.canceling',
                )
              : L('common:action.cancel')}
          </Button>
        )}
      </footer>
    </Dialog>
  );
}

function ProgressStep({
  label,
  state,
  phase,
  currentStepRef,
}: {
  label: string;
  state: StepState;
  phase: RouteOptimizationProgressPhase;
  currentStepRef: RefObject<HTMLLIElement | null>;
}) {
  const current =
    state === 'running' || state === 'failed' || state === 'cancelled';
  return (
    <li
      ref={current ? currentStepRef : undefined}
      className={`is-${state}`}
      aria-current={current ? 'step' : undefined}
    >
      <span aria-hidden="true" />
      <strong>{label}</strong>
      <small>{formatStepState(state, phase)}</small>
    </li>
  );
}
