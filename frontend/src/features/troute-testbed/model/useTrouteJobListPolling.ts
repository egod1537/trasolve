import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrouteJobHistoryItem } from '@trasolve/shared';
import { listTrouteJobs } from '@/features/troute-testbed/api/troute';
import { reuseJsonValue } from '@/shared/lib/structuralSharing';

const JOB_LIST_POLL_INTERVAL_MS = 2_000;
const RECENT_JOB_LIMIT = 50;

type JobListPollingState = {
  jobs: readonly TrouteJobHistoryItem[];
  loading: boolean;
  error: string | null;
};

type Poll = (showLoading?: boolean) => Promise<void>;

type Options = {
  onJobs?: (jobs: readonly TrouteJobHistoryItem[]) => void;
};

const initialState: JobListPollingState = {
  jobs: [],
  loading: true,
  error: null,
};

export function useTrouteJobListPolling({ onJobs }: Options = {}) {
  const [state, setState] = useState(initialState);
  const jobsRef = useRef<readonly TrouteJobHistoryItem[]>(initialState.jobs);
  const pollRef = useRef<Poll>(() => Promise.resolve());
  const refresh = useCallback(() => pollRef.current(true), []);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let inFlight: Promise<void> | null = null;
    let latestRequest = 0;
    let latestAppliedRequest = 0;

    const poll: Poll = (showLoading = false) => {
      if (disposed || document.hidden) {
        return Promise.resolve();
      }
      if (inFlight) {
        return inFlight;
      }

      const requestId = ++latestRequest;
      controller = new AbortController();
      const requestController = controller;
      if (showLoading) {
        setState((current) =>
          current.loading ? current : { ...current, loading: true },
        );
      }
      const request = listTrouteJobs(RECENT_JOB_LIMIT, requestController.signal)
        .then((jobs) => {
          if (
            disposed ||
            requestController.signal.aborted ||
            requestId !== latestRequest ||
            requestId < latestAppliedRequest
          ) {
            return;
          }
          latestAppliedRequest = requestId;
          const sharedJobs = reuseJsonValue(jobsRef.current, jobs);
          if (sharedJobs !== jobsRef.current) {
            jobsRef.current = sharedJobs;
            onJobs?.(sharedJobs);
          }
          setState((current) => {
            if (
              current.jobs === sharedJobs &&
              !current.loading &&
              current.error === null
            ) {
              return current;
            }
            return {
              jobs: sharedJobs,
              loading: false,
              error: null,
            };
          });
        })
        .catch((cause: unknown) => {
          if (disposed || requestController.signal.aborted) {
            return;
          }
          const error =
            cause instanceof Error
              ? cause.message
              : 'troute Job 목록을 불러올 수 없습니다.';
          setState((current) =>
            current.error === error && !current.loading
              ? current
              : { ...current, loading: false, error },
          );
        })
        .finally(() => {
          if (controller === requestController) {
            controller = null;
          }
          if (inFlight === request) {
            inFlight = null;
          }
        });
      inFlight = request;
      return request;
    };

    pollRef.current = poll;
    void poll();
    const timer = window.setInterval(
      () => void poll(),
      JOB_LIST_POLL_INTERVAL_MS,
    );
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        latestRequest += 1;
        controller?.abort();
        controller = null;
        inFlight = null;
        return;
      }
      void poll();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      latestRequest += 1;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      controller?.abort();
      controller = null;
      inFlight = null;
      pollRef.current = () => Promise.resolve();
    };
  }, [onJobs]);

  return { ...state, refresh };
}
