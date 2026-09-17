import { Classes } from '@blueprintjs/core';
import {
  API_ROUTES,
  isTrouteJobTerminalStatus,
  type TrouteJobHistoryItem,
  type TrouteJobState,
  type TrouteOptimizeRequest,
} from '@trasolve/shared';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  mergeRemoteJob,
  mergeRemoteJobHistory,
  selectActiveJobId,
  selectTestbedJob,
} from '@/entities/route-job';
import {
  cancelTrouteJob,
  checkTrouteHealth,
  getTrouteCancelPath,
  getTrouteJob,
  getTrouteJobEventPath,
  optimizeRouteWithTroute,
  TrouteCancelNetworkError,
  TrouteNetworkError,
} from '@/features/troute-testbed/api/troute';
import { useTheme } from '@/shared/theme/useTheme';
import { reuseJsonValue } from '@/shared/lib/structuralSharing';
import { RenderProfiler } from '@/shared/lib/RenderProfiler';
import {
  AppHeader,
  type HealthState,
} from '@/features/troute-testbed/components/AppHeader';
import { CancelJobDialog } from '@/features/troute-testbed/components/detail/CancelJobDialog';
import { JobDetail } from '@/features/troute-testbed/components/detail/JobDetail';
import { JobSidebar } from '@/features/troute-testbed/components/jobs/JobSidebar';
import type { TestbedJob } from '@/entities/route-job';
import { createTimelineId, type TimelineEntry } from '@/entities/route-job';
import {
  classifyCancelResult,
  classifyGatewayResult,
  describeCancelError,
  describeGatewayError,
} from '@/features/troute-testbed/model/gatewayResultModel';
import { useTrouteJobListPolling } from '@/features/troute-testbed/model/useTrouteJobListPolling';
import {
  useTrouteJobEventStream,
  type TrouteJobObservation,
} from '@/features/troute-testbed/model/useTrouteJobEventStream';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@/features/troute-testbed/troute-test.css';

type JobUpdate = Partial<TestbedJob> | ((current: TestbedJob) => TestbedJob);

const JobBuilderDialog = lazy(() =>
  import('@/features/troute-testbed/job-builder/JobBuilderDialog').then(
    (module) => ({
      default: module.JobBuilderDialog,
    }),
  ),
);

export default function TrouteTestbed() {
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

  const executeJob = useCallback(
    async (request: TrouteOptimizeRequest, pairId: string): Promise<void> => {
      const controller = new AbortController();
      gatewayControllers.current.set(request.job_id, controller);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (controller.signal.aborted) {
        gatewayControllers.current.delete(request.job_id);
        return;
      }
      try {
        const result = await optimizeRouteWithTroute(
          request,
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }

        setHealth('online');
        const gatewayError = describeGatewayError(result);
        const gatewayOutcome = classifyGatewayResult(result);
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
          ...(gatewayError ? { error: gatewayError } : {}),
        };

        updateJob(request.job_id, (job) => {
          const observed = {
            ...job,
            gatewayResponse: result,
            ...(gatewayError ? {} : { inspectionError: undefined }),
            timeline: [...job.timeline, responseEntry],
          };
          if (isTrouteJobTerminalStatus(job.status)) {
            return observed;
          }
          if (gatewayOutcome === 'accepted') {
            return observed;
          }
          return gatewayOutcome === 'client-rejected'
            ? {
                ...observed,
                status: 'failed' as const,
                completedAt: Date.now(),
                stage: 'failed',
                message: 'Trasolve gateway 요청이 실패했습니다.',
                error: gatewayError,
              }
            : gatewayError
              ? {
                  ...observed,
                  inspectionError: gatewayError,
                  message:
                    'Gateway 응답은 실패했지만 원격 Job 상태 조회를 계속합니다.',
                }
              : {
                  ...observed,
                  status: 'completed' as const,
                  completedAt: Date.now(),
                  progress: 100,
                  stage: job.jobState?.stage ?? 'completed',
                  message:
                    job.jobState?.last_message ??
                    'Trasolve gateway 요청이 완료되었습니다.',
                };
        });
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }

        const latencyMs =
          cause instanceof TrouteNetworkError ? cause.durationMs : undefined;
        const message =
          cause instanceof Error
            ? cause.message
            : 'Trasolve backend 요청 중 알 수 없는 오류가 발생했습니다.';
        setHealth('offline');
        updateJob(request.job_id, (job) => ({
          ...job,
          ...(isTrouteJobTerminalStatus(job.status)
            ? {}
            : {
                inspectionError: message,
                message:
                  'Gateway 연결이 끊겼지만 원격 Job 상태 조회를 계속합니다.',
              }),
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
      } finally {
        gatewayControllers.current.delete(request.job_id);
      }
    },
    [updateJob],
  );

  const selectedJob = useMemo(
    () => selectTestbedJob(jobs, selectedJobId),
    [jobs, selectedJobId],
  );
  const selectedActiveJobId = selectActiveJobId(selectedJob);
  const applyObservedJob = useCallback(
    (remote: TrouteJobState, observation: TrouteJobObservation): void => {
      updateJob(remote.job_id, (local) => {
        const merged = mergeRemoteJob(local, remote, {
          updatedAt: observation.updatedAt,
          sequence: observation.sequence,
        });
        if (observation.source !== 'event') {
          return merged;
        }
        const eventPath = getTrouteJobEventPath(remote.job_id);
        const pairId = observation.eventId ?? createTimelineId();
        return {
          ...merged,
          timeline: [
            ...merged.timeline,
            {
              id: createTimelineId(),
              pairId,
              timestamp: observation.receivedAt,
              direction: 'RESPONSE',
              source: 'trasolve',
              target: 'testbed',
              method: 'SSE',
              path: eventPath,
              status: 200,
              headers: {
                event: observation.eventType ?? 'message',
                ...(observation.eventId
                  ? { 'last-event-id': observation.eventId }
                  : {}),
              },
              body: remote,
              raw: observation.rawData ?? '',
            },
          ],
        };
      });
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
                ? '이미 종료된 Job입니다.'
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
            : 'Job 강제 종료 중 알 수 없는 오류가 발생했습니다.';
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
        message: 'Trasolve gateway 요청 실행을 기다리고 있습니다.',
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

  return (
    <div
      className={`app-shell troute-testbed-shell ${resolvedTheme === 'dark' ? Classes.DARK : ''}`}
      data-theme={resolvedTheme}
    >
      <AppHeader
        health={health}
        themeMode={themeMode}
        onRefreshHealth={handleRefreshHealth}
        onThemeChange={setThemeMode}
      />

      <main className="job-workspace">
        <RenderProfiler id="troute-job-list">
          <JobSidebar
            jobs={jobs}
            selectedJobId={selectedJobId}
            refreshing={jobListPolling.loading}
            onNewJob={openJobBuilder}
            onRefresh={refreshJobs}
            onSelect={setSelectedJobId}
          />
        </RenderProfiler>
        <RenderProfiler id="troute-job-detail">
          <JobDetail
            job={selectedJob}
            cancelling={selectedJob?.id === cancellingJobId}
            streamStatus={jobEventStream.status}
            streamError={jobEventStream.error}
            onRequestCancel={setCancelDialogJobId}
          />
        </RenderProfiler>
      </main>

      <CancelJobDialog
        isOpen={cancelDialogJobId !== null}
        loading={cancelDialogJobId === cancellingJobId}
        dark={resolvedTheme === 'dark'}
        onCancel={closeCancelDialog}
        onConfirm={confirmCancelJob}
      />

      {newJobOpen ? (
        <Suspense fallback={null}>
          <JobBuilderDialog
            isOpen
            dark={resolvedTheme === 'dark'}
            existingJobIds={existingJobIds}
            onClose={closeJobBuilder}
            onCreate={createJob}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

async function getHealthState(signal?: AbortSignal): Promise<HealthState> {
  try {
    const timeout = AbortSignal.timeout(5_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return (await checkTrouteHealth(requestSignal)) ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}
