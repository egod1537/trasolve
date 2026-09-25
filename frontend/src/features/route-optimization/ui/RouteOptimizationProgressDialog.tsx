import type { TrouteProgressStage } from '@trasolve/shared';
import { useEffect, useId, useRef, type RefObject } from 'react';
import type { RouteOptimizationProgress } from '@/features/route-optimization/api/routeOptimizationApi';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { Progress } from '@/shared/ui/Progress';

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
    label: '요청 접수',
    message: '최적화 요청을 접수했습니다.',
  },
  {
    stage: 'validating_request',
    label: '입력 검증',
    message: '장소와 일정 조건을 검증하고 있습니다.',
  },
  {
    stage: 'selecting_provider',
    label: '경로 제공자 선택',
    message: '경로 제공자를 선택하고 있습니다.',
  },
  {
    stage: 'preparing_matrix',
    label: '이동시간 조회 준비',
    message: '장소 간 이동시간 조회를 준비하고 있습니다.',
  },
  {
    stage: 'fetching_travel_times',
    label: '이동시간 조회',
    message: '장소 간 이동시간을 조회하고 있습니다.',
  },
  {
    stage: 'building_matrix',
    label: '이동시간 행렬 구성',
    message: '이동시간 행렬을 구성하고 있습니다.',
  },
  {
    stage: 'generating_candidates',
    label: '초기 경로 후보 생성',
    message: '초기 경로 후보를 생성하고 있습니다.',
  },
  {
    stage: 'optimizing_route',
    label: '경로 최적화',
    message: '방문 순서를 최적화하고 있습니다.',
  },
  {
    stage: 'selecting_best_candidate',
    label: '최적 경로 선택',
    message: '후보 경로를 비교하고 있습니다.',
  },
  {
    stage: 'scheduling',
    label: '일정 계산',
    message: '방문 일정을 계산하고 있습니다.',
  },
  {
    stage: 'validating_schedule',
    label: '일정 제약 검증',
    message: '영업시간과 체류시간 제약을 검증하고 있습니다.',
  },
  {
    stage: 'finalizing_result',
    label: '결과 생성',
    message: '최적화 결과를 정리하고 있습니다.',
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
            <strong>경로 최적화에 실패했습니다.</strong>
            <p>{error ?? '경로 최적화 요청을 완료하지 못했습니다.'}</p>
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
                  ? '경로 최적화 진행 중'
                  : `경로 최적화 진행률 ${percentage}%`
              }
            />
            <span>{percentage === undefined ? '' : `${percentage}%`}</span>
          </div>
        ) : null}

        <ol
          className="route-optimization-progress-steps"
          aria-label="경로 최적화 단계"
          tabIndex={0}
        >
          {unknownStage ? (
            <ProgressStep
              label="처리 중"
              state={getCurrentStepState(phase)}
              phase={phase}
              currentStepRef={currentStepRef}
            />
          ) : null}
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
        </ol>

        {progress && phase !== 'cancelled' ? (
          <p className="route-optimization-progress-server-status">
            서버 상태: {formatServerStatus(progress.status)}
          </p>
        ) : null}
      </div>

      <footer className="route-optimization-progress-actions">
        {phase === 'failed' ? (
          <>
            <Button onClick={onClose}>닫기</Button>
            <Button variant="primary" onClick={onRetry}>
              다시 시도
            </Button>
          </>
        ) : phase === 'cancelled' ? (
          <Button variant="primary" onClick={onClose}>
            닫기
          </Button>
        ) : phase === 'completed' ? null : (
          <Button
            loading={phase === 'cancelling'}
            disabled={phase === 'cancelling'}
            onClick={onCancel}
          >
            {phase === 'cancelling' ? '취소 중' : '취소'}
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
      return '최적화가 완료되었습니다';
    case 'failed':
      return '경로 최적화 실패';
    case 'cancelling':
      return '최적화를 취소하고 있습니다';
    case 'cancelled':
      return '최적화가 취소되었습니다';
    default:
      return '경로를 최적화하고 있습니다';
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
      return '최적화 요청을 전송하고 있습니다.';
    case 'running':
      return formatStageMessage(progress?.stage);
    case 'completed':
      return '최적화가 완료되었습니다.';
    case 'failed':
      return '요청을 다시 시도하거나 팝업을 닫을 수 있습니다.';
    case 'cancelling':
      return '실행 중인 요청과 진행 상태 연결을 정리하고 있습니다.';
    case 'cancelled':
      return '최적화가 취소되었습니다.';
  }
}

function formatStageMessage(
  stage: RouteOptimizationProgress['stage'] | undefined,
): string {
  if (stage === 'solving') {
    return '방문 순서를 최적화하고 있습니다.';
  }
  return (
    PROGRESS_STEPS.find((step) => step.stage === stage)?.message ??
    '서버의 진행 상태를 기다리고 있습니다.'
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
      return '완료';
    case 'failed':
      return '실패';
    case 'cancelled':
      return '취소됨';
    case 'running':
      return phase === 'cancelling' ? '취소 중' : '진행 중';
    case 'waiting':
      return '대기';
  }
}

function formatServerStatus(
  status: RouteOptimizationProgress['status'],
): string {
  switch (status) {
    case 'pending':
      return '대기 중';
    case 'running':
      return '실행 중';
    case 'completed':
      return '완료';
    case 'failed':
      return '실패';
    case 'cancelled':
      return '취소됨';
  }
}
