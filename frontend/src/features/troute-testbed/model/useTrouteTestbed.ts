import { observeTrouteJob } from './trouteJobObservation';
import { useTrouteGateway } from '@/features/troute-testbed/model/useTrouteGateway';

import {
  API_ROUTES,
  isTrouteJobTerminalStatus,
  type TrouteJobHistoryItem,
  type TrouteJobState,
  type TrouteOptimizeRequest,
} from '@trasolve/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  mergeRemoteJob,
  mergeRemoteJobHistory,
  selectActiveJobId,
  selectTestbedJob,
} from '@/entities/route-job';
import {
  cancelTrouteJob,
  getTrouteCancelPath,
  getTrouteJob,
  TrouteCancelNetworkError,
} from '@/features/troute-testbed/api/troute';
import { useTheme } from '@/shared/theme/useTheme';
import { reuseJsonValue } from '@/shared/lib/structuralSharing';

import { type HealthState } from '@/features/troute-testbed/components/AppHeader';

import type { TestbedJob } from '@/entities/route-job';
import { createTimelineId, type TimelineEntry } from '@/entities/route-job';
import {
  classifyCancelResult,
  describeCancelError,
} from '@/features/troute-testbed/model/gatewayResultModel';
import { useTrouteJobListPolling } from '@/features/troute-testbed/model/useTrouteJobListPolling';
import {
  useTrouteJobEventStream,
  type TrouteJobObservation,
} from '@/features/troute-testbed/model/useTrouteJobEventStream';
import { L } from '@/shared/i18n';
import { type JobUpdate } from '@/features/troute-testbed/model/trouteTestbedTypes';
import { getHealthState } from '@/features/troute-testbed/model/trouteHealth';

export function useTrouteTestbed() {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const [health, setHealth] = useState<HealthState>('checking');
  const [jobs, setJobs] = useState<TestbedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [cancelDialogJobId, setCancelDialogJobId] = useState<string | null>(
    null,
  );
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const gatewayControllers = useRef(new Map<string, AbortController>());
  const cancelController = useRef<AbortController | null>(null);
  const localJobIds = useRef(new Set<string>());
  const updateJob = useCallback((jobId: string, update: JobUpdate): void => {
    setJobs((current) => {
      const index = current.findIndex((job) => job.id === jobId);
      if (index < 0) {
        return current;
      }
      const job = current[index]!;
      const next =
        typeof update === 'function' ? update(job) : { ...job, ...update };
      const shared = reuseJsonValue(job, next);
      if (shared === job) {
        return current;
      }
      const jobs = [...current];
      jobs[index] = shared;
      return jobs;
    });
  }, []);
  const applyRemoteJobList = useCallback(
    (history: readonly TrouteJobHistoryItem[]): void => {
      const incomingIds = new Set(history.map((item) => item.state.job_id));
      incomingIds.forEach((jobId) => localJobIds.current.delete(jobId));
      setJobs((current) =>
        mergeRemoteJobHistory(current, history, localJobIds.current),
      );
      setSelectedJobId((current) => {
        if (
          current !== null &&
          (incomingIds.has(current) || localJobIds.current.has(current))
        ) {
          return current;
        }
        return history[0]?.state.job_id ?? null;
      });
    },
    [],
  );
  const jobListPolling = useTrouteJobListPolling({
    onJobs: applyRemoteJobList,
  });
  const refreshJobList = jobListPolling.refresh;
  const appendTimeline = useCallback(
    (jobId: string, entry: TimelineEntry): void => {
      updateJob(jobId, (job) => ({
        ...job,
        timeline: [...job.timeline, entry],
      }));
    },
    [updateJob],
  );
  const refreshHealth = useCallback(async (signal?: AbortSignal) => {
    setHealth('checking');
    setHealth(await getHealthState(signal));
  }, []);
  const handleRefreshHealth = useCallback(
    () => void refreshHealth(),
    [refreshHealth],
  );
  useEffect(() => {
    const controller = new AbortController();
    void getHealthState(controller.signal).then((nextHealth) => {
      if (!controller.signal.aborted) {
        setHealth(nextHealth);
      }
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (jobListPolling.error) {
      console.error(
        '저장된 troute Job 목록을 불러오지 못했습니다.',
        jobListPolling.error,
      );
    }
  }, [jobListPolling.error]);
  useEffect(() => {
    const controllers = gatewayControllers.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      cancelController.current?.abort();
      cancelController.current = null;
    };
  }, []);
  const executeJob = useTrouteGateway({
    gatewayControllers,
    updateJob,
    setHealth,
  });
  const selectedJob = useMemo(
    () => selectTestbedJob(jobs, selectedJobId),
    [jobs, selectedJobId],
  );
  const selectedActiveJobId = selectActiveJobId(selectedJob);
  const applyObservedJob = useCallback(
    (remote: TrouteJobState, observation: TrouteJobObservation) => {
      updateJob(remote.job_id, (local) =>
        observeTrouteJob(local, remote, observation),
      );
    },
    [updateJob],
  );
  const jobEventStream = useTrouteJobEventStream(selectedActiveJobId, {
    onJob: applyObservedJob,
  });
  const cancelJob = useCallback(
    async (jobId: string): Promise<void> => {
      const controller = new AbortController();
      cancelController.current?.abort();
      cancelController.current = controller;
      setCancellingJobId(jobId);

      const pairId = createTimelineId();
      const path = getTrouteCancelPath(jobId);
      appendTimeline(jobId, {
        id: createTimelineId(),
        pairId,
        timestamp: Date.now(),
        direction: 'REQUEST',
        source: 'testbed',
        target: 'trasolve',
        method: 'POST',
        path,
        query: {},
        raw: '',
      });
      updateJob(jobId, { cancelError: undefined });

      try {
        const result = await cancelTrouteJob(jobId, controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        const error = describeCancelError(result);
        const cancelOutcome = classifyCancelResult(result);
        const responseEntry: TimelineEntry = {
          id: createTimelineId(),
          pairId,
          timestamp: Date.now(),
          direction: 'RESPONSE',
          source: 'trasolve',
          target: 'testbed',
          status: result.httpStatus,
          latencyMs: result.durationMs,
          body: result.responseBody,
          raw: result.rawResponse,
          ...(error ? { error } : {}),
        };

        const cancelledState = result.jobState;
        if (cancelOutcome === 'cancelled' && cancelledState) {
          gatewayControllers.current.get(jobId)?.abort();
          setHealth('online');
          updateJob(jobId, (job) => ({
            ...mergeRemoteJob(job, cancelledState),
            timeline: [...job.timeline, responseEntry],
          }));
          setCancelDialogJobId(null);
          return;
        }

        if (cancelOutcome === 'accepted' && cancelledState) {
          setHealth('online');
          updateJob(jobId, (job) => ({
            ...mergeRemoteJob(job, cancelledState),
            timeline: [...job.timeline, responseEntry],
          }));
          setCancelDialogJobId(null);
          return;
        }

        if (cancelOutcome === 'server-rejected') {
          setHealth('offline');
        }

        let latestState: TrouteJobState | null = null;
        if (cancelOutcome === 'conflict') {
          try {
            latestState = await getTrouteJob(jobId, controller.signal);
          } catch {
            // The cancel response remains the primary diagnostic.
          }
        }

        updateJob(jobId, (job) => {
          const current = latestState ? mergeRemoteJob(job, latestState) : job;
          return {
            ...current,
            cancelError:
              cancelOutcome === 'conflict' &&
              latestState !== null &&
              isTrouteJobTerminalStatus(latestState.status)
                ? L('testbed:trouteTestbed.text.thisJobHasAlreadyEnded')
                : error,
            timeline: [...current.timeline, responseEntry],
          };
        });
        setCancelDialogJobId(null);
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          cause instanceof Error
            ? cause.message
            : L(
                'testbed:trouteTestbed.text.unknownErrorOccurredWhileForcingJob',
              );
        const latencyMs =
          cause instanceof TrouteCancelNetworkError
            ? cause.durationMs
            : undefined;
        setHealth('offline');
        updateJob(jobId, (job) => ({
          ...job,
          cancelError: message,
          timeline: [
            ...job.timeline,
            {
              id: createTimelineId(),
              pairId,
              timestamp: Date.now(),
              direction: 'RESPONSE',
              source: 'trasolve',
              target: 'testbed',
              ...(latencyMs === undefined ? {} : { latencyMs }),
              error: message,
            },
          ],
        }));
        setCancelDialogJobId(null);
      } finally {
        if (cancelController.current === controller) {
          cancelController.current = null;
          setCancellingJobId(null);
        }
      }
    },
    [appendTimeline, updateJob],
  );
  const existingJobIds = useMemo(
    () => new Set(jobs.map((job) => job.id)),
    [jobs],
  );
  const createJob = useCallback(
    (request: TrouteOptimizeRequest): void => {
      const pairId = createTimelineId();
      const requestBody = JSON.stringify(request);
      const job: TestbedJob = {
        id: request.job_id,
        status: 'pending',
        createdAt: Date.now(),
        progress: 0,
        stage: 'queued',
        message: L(
          'testbed:trouteTestbed.message.waitingTrasolveGatewayRequestBeExecuted',
        ),
        request,
        timeline: [
          {
            id: createTimelineId(),
            pairId,
            timestamp: Date.now(),
            direction: 'REQUEST',
            source: 'testbed',
            target: 'trasolve',
            method: 'POST',
            path: API_ROUTES.trouteOptimize,
            headers: { 'Content-Type': 'application/json' },
            query: {},
            body: request,
            raw: requestBody,
          },
        ],
      };

      localJobIds.current.add(job.id);
      setJobs((current) => [job, ...current]);
      setSelectedJobId(job.id);
      setNewJobOpen(false);
      void executeJob(request, pairId);
    },
    [executeJob],
  );
  const openJobBuilder = useCallback(() => setNewJobOpen(true), []);
  const closeJobBuilder = useCallback(() => setNewJobOpen(false), []);
  const refreshJobs = useCallback(
    () => void refreshJobList(),
    [refreshJobList],
  );
  const closeCancelDialog = useCallback(() => {
    if (cancellingJobId === null) {
      setCancelDialogJobId(null);
    }
  }, [cancellingJobId]);
  const confirmCancelJob = useCallback(() => {
    if (cancelDialogJobId !== null && cancellingJobId === null) {
      void cancelJob(cancelDialogJobId);
    }
  }, [cancelDialogJobId, cancelJob, cancellingJobId]);
  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
    health,
    jobs,
    selectedJobId,
    setSelectedJobId,
    newJobOpen,
    cancelDialogJobId,
    setCancelDialogJobId,
    cancellingJobId,
    jobListPolling,
    handleRefreshHealth,
    selectedJob,
    jobEventStream,
    existingJobIds,
    createJob,
    openJobBuilder,
    closeJobBuilder,
    refreshJobs,
    closeCancelDialog,
    confirmCancelJob,
  };
}
