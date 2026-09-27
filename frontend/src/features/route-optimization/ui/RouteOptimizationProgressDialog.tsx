import type { TrouteProgressStage } from '@trasolve/shared';
import { useEffect, useId, useRef, type RefObject } from 'react';
import type { RouteOptimizationProgress } from '@/features/route-optimization/api/routeOptimizationApi';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { Progress } from '@/shared/ui/Progress';
import { useL, L } from '@/shared/i18n';

export type RouteOptimizationProgressPhase =
  | 'submitting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelling'
  | 'cancelled';

type Props = {
  phase: RouteOptimizationProgressPhase;
  progress: RouteOptimizationProgress | null;
  error: string | null;
  onCancel: () => void;
  onClose: () => void;
  onRetry: () => void;
};

const PROGRESS_STEPS = [
  {
    stage: 'accepted',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.requestReceived',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.optimizationRequestHasBeenReceived',
      );
    },
  },
  {
    stage: 'validating_request',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.inputValidation',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.weVerifyingLocationScheduleConditions',
      );
    },
  },
  {
    stage: 'selecting_provider',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.selectRouteProvider',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.youSelectingRouteProvider',
      );
    },
  },
  {
    stage: 'preparing_matrix',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.preparingCheckTravelTime',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.wePreparingCheckTravelTimesBetween',
      );
    },
  },
  {
    stage: 'fetching_travel_times',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.travelTimeInquiry',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.weLookingUpTravelTimesBetween',
      );
    },
  },
  {
    stage: 'building_matrix',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.constructingTravelTimeMatrix',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.weConstructingTravelTimeMatrix',
      );
    },
  },
  {
    stage: 'generating_candidates',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.generateInitialRouteCandidates',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.weGeneratingInitialRouteCandidates',
      );
    },
  },
  {
    stage: 'optimizing_route',
    get label() {
      return L(
        'routeOptimization:routeOptimizationModal.title.routeOptimization',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.weOptimizingOrderVisits',
      );
    },
  },
  {
    stage: 'selecting_best_candidate',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.chooseOptimalRoute',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.comparingCandidatePaths',
      );
    },
  },
  {
    stage: 'scheduling',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.scheduleCalculation',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.weCalculatingItineraryVisit',
      );
    },
  },
  {
    stage: 'validating_schedule',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.scheduleConstraintVerification',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.weVerifyingBusinessHoursResidenceTime',
      );
    },
  },
  {
    stage: 'finalizing_result',
    get label() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.label.generateResults',
      );
    },
    get message() {
      return L(
        'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.weOrganizingOptimizationResults',
      );
    },
  },
] as const satisfies readonly {
  stage: TrouteProgressStage;
  label: string;
  message: string;
}[];

type StepState = 'completed' | 'running' | 'waiting' | 'failed' | 'cancelled';

export function RouteOptimizationProgressDialog({
  phase,
  progress,
  error,
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
              {error ??
                L(
                  'routeOptimization:routeOptimizationProgressDialog.description.routeOptimizationRequestCouldNotBe',
                )}
            </p>
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

function getTitle(phase: RouteOptimizationProgressPhase): string {
  switch (phase) {
    case 'completed':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getTitle.text.optimizationComplete',
      );
    case 'failed':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getTitle.text.pathOptimizationFailed',
      );
    case 'cancelling':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getTitle.text.cancelingOptimization',
      );
    case 'cancelled':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getTitle.text.optimizationHasBeenCanceled',
      );
    default:
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getTitle.text.optimizingRoute',
      );
  }
}

function getMessage(
  phase: RouteOptimizationProgressPhase,
  progress: RouteOptimizationProgress | null,
): string {
  if (progress?.last_message) {
    return progress.last_message;
  }
  switch (phase) {
    case 'submitting':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getMessage.text.sendingOptimizationRequest',
      );
    case 'running':
      return formatStageMessage(progress?.stage);
    case 'completed':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getMessage.text.optimizationComplete',
      );
    case 'failed':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getMessage.text.youCanRetryRequestClosePop',
      );
    case 'cancelling':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getMessage.text.cleaningUpConnectionsBetweenRunningRequests',
      );
    case 'cancelled':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.getMessage.text.optimizationHasBeenCancelled',
      );
  }
}

function formatStageMessage(
  stage: RouteOptimizationProgress['stage'] | undefined,
): string {
  if (stage === 'solving') {
    return L(
      'routeOptimization:routeOptimizationProgressDialog.pROGRESSSTEPS.message.weOptimizingOrderVisits',
    );
  }
  return (
    PROGRESS_STEPS.find((step) => step.stage === stage)?.message ??
    L(
      'routeOptimization:routeOptimizationProgressDialog.formatStageMessage.text.waitingServerSProgress',
    )
  );
}

function getStepState(
  phase: RouteOptimizationProgressPhase,
  stage: TrouteProgressStage | null,
  index: number,
): StepState {
  if (phase === 'completed') {
    return 'completed';
  }
  const resolvedIndex = getProgressStepIndex(stage);
  const currentIndex = stage === null ? 0 : resolvedIndex;
  if (currentIndex < 0) {
    return 'waiting';
  }
  if (index < currentIndex) {
    return 'completed';
  }
  if (index > currentIndex) {
    return 'waiting';
  }
  if (phase === 'failed') {
    return 'failed';
  }
  if (phase === 'cancelled') {
    return 'cancelled';
  }
  return 'running';
}

function getCurrentStepState(
  phase: RouteOptimizationProgressPhase,
): Exclude<StepState, 'completed' | 'waiting'> {
  if (phase === 'failed') {
    return 'failed';
  }
  if (phase === 'cancelled') {
    return 'cancelled';
  }
  return 'running';
}

function getProgressStepIndex(stage: TrouteProgressStage | null): number {
  if (stage === 'solving') {
    return PROGRESS_STEPS.findIndex(
      (step) => step.stage === 'optimizing_route',
    );
  }
  return PROGRESS_STEPS.findIndex((step) => step.stage === stage);
}

function getProgressTone(
  phase: RouteOptimizationProgressPhase,
): 'accent' | 'danger' | 'warning' | 'success' {
  switch (phase) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'cancelling':
    case 'cancelled':
      return 'warning';
    default:
      return 'accent';
  }
}

function formatStepState(
  state: StepState,
  phase: RouteOptimizationProgressPhase,
): string {
  switch (state) {
    case 'completed':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.formatStepState.text.done',
      );
    case 'failed':
      return L(
        'routeOptimization:routeOptimizationModal.formatDayStatus.text.failure',
      );
    case 'cancelled':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.formatStepState.text.canceled',
      );
    case 'running':
      return phase === 'cancelling'
        ? L(
            'routeOptimization:routeOptimizationProgressDialog.action.canceling',
          )
        : L(
            'routeOptimization:routeOptimizationProgressDialog.formatStepState.text.progress',
          );
    case 'waiting':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.formatStepState.text.waiting',
      );
  }
}

function formatServerStatus(
  status: RouteOptimizationProgress['status'],
): string {
  switch (status) {
    case 'pending':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.formatServerStatus.text.waiting',
      );
    case 'running':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.formatServerStatus.text.running',
      );
    case 'completed':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.formatStepState.text.done',
      );
    case 'failed':
      return L(
        'routeOptimization:routeOptimizationModal.formatDayStatus.text.failure',
      );
    case 'cancelled':
      return L(
        'routeOptimization:routeOptimizationProgressDialog.formatStepState.text.canceled',
      );
  }
}
