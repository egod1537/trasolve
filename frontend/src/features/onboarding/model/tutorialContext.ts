import { createContext, useContext } from 'react';
import type { TutorialProgress } from '@trasolve/shared';
import type { TutorialMode } from '../opts';

export type TutorialController = {
  active: boolean;
  run: number;
  progress: TutorialProgress;
  debug: boolean;
  mode: TutorialMode;
  loading: boolean;
  error: boolean;
  step(index: number): void;
  created(tripId: string): void;
  completeStep(step: 'days' | 'add-place'): void;
  restart(): void;
  stop(completed?: boolean): void;
  reset(): void;
  setMode(mode: TutorialMode): void;
  retry(): void;
};

export const TutorialContext = createContext<TutorialController | null>(null);
export function useTutorial(): TutorialController | null {
  return useContext(TutorialContext);
}
