import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useTutorial } from '@/features/onboarding';
import type { RouteComparisonData } from '@/features/route-optimization';

export function useOptimizationTutorialProgress(
  data: RouteComparisonData | null,
) {
  const tutorial = useTutorial();
  const tutorialRef = useRef(tutorial);
  useLayoutEffect(() => {
    tutorialRef.current = tutorial;
  }, [tutorial]);

  const sync = useCallback((next: RouteComparisonData | null) => {
    const activeTutorial = tutorialRef.current;
    if (!activeTutorial?.active) {
      return;
    }
    const step = activeTutorial.progress.step;
    if (next?.live && (step === 'optimize' || step === 'optimize-result')) {
      activeTutorial.step('optimize-running');
    } else if (
      next &&
      !next.live &&
      (step === 'optimize' || step === 'optimize-running')
    ) {
      activeTutorial.step('optimize-result');
    } else if (
      !next &&
      (step === 'optimize-running' || step === 'optimize-result')
    ) {
      activeTutorial.step('optimize');
    }
  }, []);

  useEffect(() => {
    sync(data);
  }, [data, sync, tutorial?.active, tutorial?.progress.step]);

  const resetResult = useCallback(() => {
    const activeTutorial = tutorialRef.current;
    if (
      activeTutorial?.active &&
      activeTutorial.progress.step === 'optimize-result'
    ) {
      activeTutorial.step('optimize');
    }
  }, []);

  const complete = useCallback(() => {
    const activeTutorial = tutorialRef.current;
    if (
      activeTutorial?.active &&
      activeTutorial.progress.step === 'optimize-result'
    ) {
      activeTutorial.step('ai');
    }
  }, []);

  return { sync, resetResult, complete };
}
