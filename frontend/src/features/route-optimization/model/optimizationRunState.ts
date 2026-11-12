import type {
  RouteOptimizationFailure,
  RouteOptimizationProgress,
} from '../api/optimizationApiTypes';

export type RouteOptimizationProgressPhase =
  | 'submitting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelling'
  | 'cancelled';

type RunPhase = RouteOptimizationProgressPhase | 'idle' | 'playback';

export type OptimizationRunState = {
  revision: number;
  phase: RunPhase;
  progress: RouteOptimizationProgress | null;
  error: RouteOptimizationFailure | null;
};

export type OptimizationRunAction =
  | { type: 'start'; revision: number }
  | { type: 'dismiss' }
  | { type: 'progress'; revision: number; progress: RouteOptimizationProgress }
  | {
      type: 'playback' | 'cancel' | 'cancelled' | 'completed';
      revision: number;
    }
  | { type: 'failed'; revision: number; error: RouteOptimizationFailure };

export const INITIAL_OPTIMIZATION_RUN: OptimizationRunState = {
  revision: 0,
  phase: 'idle',
  progress: null,
  error: null,
};

export function isOptimizationActive(phase: RunPhase): boolean {
  return (
    phase === 'submitting' ||
    phase === 'running' ||
    phase === 'playback' ||
    phase === 'cancelling'
  );
}

export function optimizationRunReducer(
  state: OptimizationRunState,
  action: OptimizationRunAction,
): OptimizationRunState {
  if (action.type === 'start') {
    return action.revision > state.revision &&
      !isOptimizationActive(state.phase)
      ? {
          ...INITIAL_OPTIMIZATION_RUN,
          revision: action.revision,
          phase: 'submitting',
        }
      : state;
  }
  if (action.type === 'dismiss') {
    return isOptimizationActive(state.phase)
      ? state
      : { ...INITIAL_OPTIMIZATION_RUN, revision: state.revision };
  }
  if (
    action.revision !== state.revision ||
    !isOptimizationActive(state.phase)
  ) {
    return state;
  }
  switch (action.type) {
    case 'progress':
      return state.phase === 'submitting' || state.phase === 'running'
        ? { ...state, phase: 'running', progress: action.progress }
        : state;
    case 'playback':
      return state.phase === 'submitting' || state.phase === 'running'
        ? { ...state, phase: 'playback' }
        : state;
    case 'cancel':
      return { ...state, phase: 'cancelling' };
    case 'cancelled':
      return { ...state, phase: 'cancelled' };
    case 'failed':
      return { ...state, phase: 'failed', error: action.error };
    case 'completed':
      return state.phase === 'playback'
        ? { ...state, phase: 'completed' }
        : state;
  }
}
