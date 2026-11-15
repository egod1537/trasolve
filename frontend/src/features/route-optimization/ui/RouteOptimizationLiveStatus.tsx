import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useL } from '@/shared/i18n';
import { RouteOptimizationFailureDetails } from './RouteOptimizationFailureDetails';
import {
  PROGRESS_STEPS,
  getTitle,
  getMessage,
  formatStageMessage,
  type Props,
} from './optimizationProgressPresentation';

/** Non-modal status surface: the route remains visible and the map usable. */
export function RouteOptimizationLiveStatus(
  props: Omit<Props, 'onCancel' | 'onClose' | 'onRetry'> & {
    playback?: boolean;
  },
) {
  const { phase, progress, error, places, playback } = props;
  const L = useL();
  const startedAt = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const active =
    phase === 'submitting' || phase === 'running' || phase === 'cancelling';
  useEffect(() => {
    if (phase === 'submitting' || startedAt.current === 0) {
      startedAt.current = Date.now();
    }
  }, [phase]);
  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [active]);
  const stageIndex = PROGRESS_STEPS.findIndex(
    (step) => step.stage === progress?.stage,
  );
  const previewing =
    playback && (phase === 'submitting' || phase === 'running');
  const group =
    phase === 'completed'
      ? 3
      : previewing
        ? 2
        : stageIndex < 6
          ? 0
          : stageIndex < 9
            ? 1
            : 2;
  const title = getTitle(phase);
  const steps = [PROGRESS_STEPS[4]!, PROGRESS_STEPS[7]!, PROGRESS_STEPS[11]!];
  const clock = `${Math.floor(elapsed / 60)
    .toString()
    .padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  return createPortal(
    <section
      className={`route-optimization-live-status${phase === 'failed' ? ' is-failure' : ''}`}
      aria-label={title}
      aria-busy={active}
    >
      <header>
        <LiveStatusIndicator active={active} failed={phase === 'failed'} />
        <strong>{title}</strong>
        <time>{clock}</time>
      </header>
      <p role={phase === 'failed' ? 'alert' : 'status'}>
        {previewing
          ? formatStageMessage('selecting_best_candidate')
          : phase === 'failed'
            ? (error?.message ?? getMessage(phase, null))
            : phase === 'running'
              ? formatStageMessage(progress?.stage)
              : getMessage(phase, null)}
      </p>
      {phase !== 'failed' && (
        <ol
          aria-label={L(
            'routeOptimization:routeOptimizationProgressDialog.ariaLabel.pathOptimizationPhase',
          )}
        >
          {steps.map((step, index) => (
            <li
              key={step.stage}
              data-state={
                index < group ? 'done' : index === group ? 'active' : 'pending'
              }
              aria-current={index === group ? 'step' : undefined}
            >
              <span aria-hidden="true">{index < group ? '✓' : index + 1}</span>
              {step.label}
            </li>
          ))}
        </ol>
      )}
      {phase === 'failed' && (
        <RouteOptimizationFailureDetails
          error={error?.trouteError ?? null}
          places={places}
        />
      )}
    </section>,
    document.body,
  );
}

function LiveStatusIndicator({
  active,
  failed,
}: {
  active: boolean;
  failed: boolean;
}) {
  return (
    <span
      className={`route-live-indicator${active ? ' is-active' : ''}${failed ? ' is-failure' : ''}`}
      aria-hidden="true"
    >
      {failed && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m10.3 4.2-7.8 13.5A2 2 0 0 0 4.2 21h15.6a2 2 0 0 0 1.7-3.3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4m0 4h.01" />
        </svg>
      )}
    </span>
  );
}
