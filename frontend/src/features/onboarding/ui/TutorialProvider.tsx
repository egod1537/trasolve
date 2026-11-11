import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  initialTutorialProgress,
  TUTORIAL_STEPS,
  TUTORIAL_VERSION,
  type TutorialProgress,
} from '@trasolve/shared';
import {
  TutorialContext,
  type TutorialController,
} from '../model/tutorialContext';
import { useTutorialProgress } from '../model/useTutorialProgress';
import {
  resolveTutorialMode,
  saveTutorialMode,
  type TutorialMode,
} from '../opts';
import { TutorialGuide } from './TutorialGuide';

type Props = {
  userId: string;
  enabled: boolean;
  debug: boolean;
  children: ReactNode;
};

export function TutorialProvider({ userId, enabled, debug, children }: Props) {
  const [mode, updateMode] = useState(() => resolveTutorialMode(debug));
  const [active, setActive] = useState(false);
  const [run, setRun] = useState(0);
  const [progress, setProgress] = useState(initialTutorialProgress);
  const progressRef = useRef(progress);
  const preview = useRef(false);

  const begin = useCallback(
    (initial: TutorialProgress | null, nextMode: TutorialMode) => {
      setActive(false);
      if (
        !enabled ||
        nextMode === 'off' ||
        (!initial && nextMode !== 'always')
      ) {
        return;
      }
      preview.current = nextMode === 'always';
      if (!preview.current && initial!.version > TUTORIAL_VERSION) {
        return;
      }
      const next =
        preview.current || initial!.version < TUTORIAL_VERSION
          ? initialTutorialProgress()
          : initial!;
      progressRef.current = next;
      setProgress(next);
      if (next.status === 'completed' || next.status === 'skipped') {
        return;
      }
      setRun((value) => value + 1);
      setActive(true);
    },
    [enabled],
  );
  const store = useTutorialProgress(userId, (initial) => begin(initial, mode));
  const { save } = store;

  const update = useCallback(
    (next: TutorialProgress) => {
      progressRef.current = next;
      setProgress(next);
      if (!preview.current) {
        save(next);
      }
    },
    [save],
  );

  const step = useCallback(
    (index: number) => {
      const nextStep = TUTORIAL_STEPS[index];
      if (!nextStep) {
        return;
      }
      const current = progressRef.current;
      if (current.status === 'completed' || current.status === 'skipped') {
        return;
      }
      if (current.step === nextStep && current.status === 'in-progress') {
        return;
      }
      update({ ...current, step: nextStep, status: 'in-progress' });
    },
    [update],
  );

  const created = useCallback(
    (tripId: string) => {
      if (
        active &&
        progressRef.current.step === 'create' &&
        progressRef.current.status === 'in-progress'
      ) {
        update({
          ...progressRef.current,
          tripId,
          step: 'days',
          status: 'in-progress',
        });
      }
    },
    [active, update],
  );

  const completeStep = useCallback(
    (expected: 'days' | 'add-place') => {
      const current = progressRef.current;
      if (current.step === expected && current.status === 'in-progress') {
        step(TUTORIAL_STEPS.findIndex((value) => value === expected) + 1);
      }
    },
    [step],
  );

  const restart = useCallback(() => {
    // Replaying is a preview and never clears an account's completion marker.
    preview.current = true;
    const next = initialTutorialProgress();
    progressRef.current = next;
    setProgress(next);
    setRun((value) => value + 1);
    setActive(true);
  }, []);

  const stop = useCallback(
    (completed = false) => {
      update({
        ...progressRef.current,
        status: completed ? 'completed' : 'skipped',
      });
      setActive(false);
    },
    [update],
  );

  const reset = useCallback(() => {
    setActive(false);
    preview.current = false;
    update(initialTutorialProgress());
  }, [update]);

  const setMode = useCallback(
    (next: TutorialMode) => {
      if (!debug) {
        return;
      }
      saveTutorialMode(next);
      updateMode(next);
      begin(store.initial, next);
    },
    [debug, begin, store.initial],
  );

  const value: TutorialController = {
    active,
    run,
    progress,
    debug,
    mode,
    loading: store.loading,
    error: store.error,
    step,
    created,
    completeStep,
    restart,
    stop,
    reset,
    setMode,
    retry: store.retry,
  };

  return (
    <TutorialContext value={enabled ? value : null}>
      {children}
      {enabled && active && <TutorialGuide />}
    </TutorialContext>
  );
}
