import { useEffect, useReducer, useRef } from 'react';
import type { TripDay } from '@trasolve/shared';
import type { RouteOptimizationFailure } from '../api/optimizationApiTypes';
import type { Props } from './optimizationModalTypes';
import type { RouteOptimizationRequestOptions } from './routeOptimization';
import { runRouteOptimization } from './runRouteOptimization';
import {
  INITIAL_OPTIMIZATION_RUN,
  isOptimizationActive,
  optimizationRunReducer,
} from './optimizationRunState';
import { useLiveRoutePreview } from './useLiveRoutePreview';

export function useOptimizationRun(
  onCompare: Props['onCompare'],
  formatFailure: (cause: unknown) => RouteOptimizationFailure,
) {
  const [state, dispatch] = useReducer(
    optimizationRunReducer,
    INITIAL_OPTIMIZATION_RUN,
  );
  const controllerRef = useRef<AbortController | null>(null);
  const revisionRef = useRef(0);
  const preview = useLiveRoutePreview(onCompare);
  useEffect(
    () => () => {
      const controller = controllerRef.current;
      controllerRef.current = null;
      controller?.abort();
    },
    [],
  );
  const dismiss = () => {
    if (controllerRef.current) {
      return;
    }
    preview.stop();
    onCompare(null);
    dispatch({ type: 'dismiss' });
  };
  const run = async (
    day: TripDay,
    settings: RouteOptimizationRequestOptions,
    onRetry: () => void,
  ) => {
    if (controllerRef.current) {
      return;
    }
    const sourceDay = structuredClone(day);
    const controller = new AbortController();
    const revision = ++revisionRef.current;
    const current = () => controllerRef.current === controller;
    controllerRef.current = controller;
    dispatch({ type: 'start', revision });
    preview.start(sourceDay, settings, () => {
      if (!current()) {
        return;
      }
      preview.end('cancelling');
      dispatch({ type: 'cancel', revision });
      controller.abort();
    });
    try {
      const comparison = await runRouteOptimization({
        day: sourceDay,
        settings,
        signal: controller.signal,
        onProgress: (progress) => {
          if (current()) {
            dispatch({ type: 'progress', revision, progress });
          }
        },
        onPreview: (frameRevision, result) => {
          if (current()) {
            preview.receive(frameRevision, result);
          }
        },
      });
      controller.signal.throwIfAborted();
      if (!current()) {
        return;
      }
      dispatch({ type: 'playback', revision });
      await preview.finish(comparison, controller.signal);
      controller.signal.throwIfAborted();
      if (!current()) {
        return;
      }
      preview.stop();
      dispatch({ type: 'completed', revision });
      onCompare(comparison);
    } catch (cause) {
      if (!current()) {
        return;
      }
      const actions = { onRetry, onClose: dismiss };
      if (controller.signal.aborted) {
        preview.end('cancelled', actions);
        dispatch({ type: 'cancelled', revision });
      } else {
        preview.end('failed', actions);
        dispatch({ type: 'failed', revision, error: formatFailure(cause) });
      }
    } finally {
      if (current()) {
        controllerRef.current = null;
      }
    }
  };
  return {
    run,
    running: isOptimizationActive(state.phase),
    runRevision: state.revision,
    playback: state.phase === 'playback',
    phase:
      state.phase === 'idle'
        ? null
        : state.phase === 'playback'
          ? ('running' as const)
          : state.phase,
    progress: state.progress,
    error: state.error,
  };
}
