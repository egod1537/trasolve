import type { TrouteProgressStage } from '@trasolve/shared';
import { useId } from 'react';
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

const PROGRESS_STEPS: readonly {
  stage: TrouteProgressStage;
  label: string;
}[] = [
  { stage: 'accepted', label: '요청 준비' },
  { stage: 'building_matrix', label: '이동시간 조회' },
  { stage: 'solving', label: '경로 탐색' },
  { stage: 'scheduling', label: '결과 정리' },
];

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
  const terminal =
    phase === 'completed' || phase === 'failed' || phase === 'cancelled';
  const active = phase === 'submitting' || phase === 'running';
  const percentage =
    phase === 'running' || phase === 'completed'
      ? progress?.progress
      : undefined;

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

        {phase !== 'failed' &&
        phase !== 'cancelled' &&
        (phase !== 'completed' || percentage !== undefined) ? (
          <div className="route-optimization-progress-meter">
            <Progress
              value={percentage}
              tone={phase === 'completed' ? 'success' : 'accent'}
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

        <ol className="route-optimization-progress-steps">
          {PROGRESS_STEPS.map((step, index) => {
            const state = getStepState(phase, progress?.stage ?? null, index);
            return (
              <li key={step.stage} className={`is-${state}`}>
                <span aria-hidden="true" />
                <strong>{step.label}</strong>
                <small>{formatStepState(state, phase)}</small>
              </li>
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
  switch (phase) {
    case 'submitting':
      return '최적화 요청을 전송하고 있습니다.';
    case 'running':
      return progress?.last_message ?? formatStageMessage(progress?.stage);
    case 'completed':
      return '최적화 결과를 화면에 반영하고 있습니다.';
    case 'failed':
      return '요청을 다시 시도하거나 팝업을 닫을 수 있습니다.';
    case 'cancelling':
      return '실행 중인 요청과 진행 상태 연결을 정리하고 있습니다.';
    case 'cancelled':
      return '기존 경로와 이전 최적화 결과는 그대로 유지됩니다.';
  }
}

function formatStageMessage(
  stage: RouteOptimizationProgress['stage'] | undefined,
): string {
  switch (stage) {
    case 'accepted':
      return '최적화 요청을 준비하고 있습니다.';
    case 'building_matrix':
      return '이동시간 데이터를 분석하고 있습니다.';
    case 'solving':
      return '가능한 방문 순서를 탐색하고 있습니다.';
    case 'scheduling':
      return '최적화된 일정을 정리하고 있습니다.';
    default:
      return '서버의 진행 상태를 기다리고 있습니다.';
  }
}

function getStepState(
  phase: RouteOptimizationProgressPhase,
  stage: TrouteProgressStage | null,
  index: number,
): StepState {
  if (phase === 'completed') {
    return 'completed';
  }
  const currentIndex = Math.max(
    0,
    PROGRESS_STEPS.findIndex((step) => step.stage === stage),
  );
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
