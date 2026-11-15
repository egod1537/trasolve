import type { TripPlace, TrouteProgressStage } from '@trasolve/shared';
import type {
  RouteOptimizationFailure,
  RouteOptimizationProgress,
} from '@/features/route-optimization/api/routeOptimizationApi';
import { L } from '@/shared/i18n';

import type { RouteOptimizationProgressPhase } from '../model/optimizationRunState';
export type { RouteOptimizationProgressPhase } from '../model/optimizationRunState';

export type Props = {
  phase: RouteOptimizationProgressPhase;
  progress: RouteOptimizationProgress | null;
  error: RouteOptimizationFailure | null;
  places: readonly TripPlace[];
  onCancel: () => void;
  onClose: () => void;
  onRetry: () => void;
};

export const PROGRESS_STEPS = [
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

export type StepState =
  'completed' | 'running' | 'waiting' | 'failed' | 'cancelled';

export function getTitle(phase: RouteOptimizationProgressPhase): string {
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

export function getMessage(
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

export function formatStageMessage(
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

export function getStepState(
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

export function getCurrentStepState(
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

export function getProgressStepIndex(
  stage: TrouteProgressStage | null,
): number {
  if (stage === 'solving') {
    return PROGRESS_STEPS.findIndex(
      (step) => step.stage === 'optimizing_route',
    );
  }
  return PROGRESS_STEPS.findIndex((step) => step.stage === stage);
}

export function getProgressTone(
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

export function formatStepState(
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

export function formatServerStatus(
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
