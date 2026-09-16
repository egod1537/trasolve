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
  cancelTrouteJob,
  checkTrouteHealth,
  getTrouteJob,
  getTrouteCancelPath,
  listTrouteJobs,
  optimizeRouteWithTroute,
  TrouteNetworkError,
  TrouteCancelNetworkError,
  type TrouteCancelGatewayResult,
  type TrouteGatewayResult,
} from '../../../api/troute';
import { useTheme } from '../../../shared/theme/useTheme';
import { AppHeader, type HealthState } from './components/AppHeader';
import { CancelJobDialog } from './components/detail/CancelJobDialog';
import { JobDetail } from './components/detail/JobDetail';
import { JobSidebar } from './components/jobs/JobSidebar';
import type { TestbedJob } from './jobs';
import { createTimelineId, type TimelineEntry } from './timeline';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../styles/troute-test.css';

type JobUpdate = Partial<TestbedJob> | ((current: TestbedJob) => TestbedJob);

type JobsRefreshRequest = {
  controller: AbortController;
  promise: Promise<void>;
};

const JOB_LIST_REFRESH_INTERVAL_MS = 2_000;
const ACTIVE_JOB_REFRESH_INTERVAL_MS = 1_000;
const RECENT_JOB_LIMIT = 50;

const JobBuilderDialog = lazy(() =>
  import('./job-builder/JobBuilderDialog').then((module) => ({
    default: module.JobBuilderDialog,
  })),
);

export default function TrouteTestPage() {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const [health, setHealth] = useState<HealthState>('checking');
  const [jobs, setJobs] = useState<TestbedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [refreshingJobs, setRefreshingJobs] = useState(true);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [cancelDialogJobId, setCancelDialogJobId] = useState<string | null>(
    null,
  );
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const gatewayControllers = useRef(new Map<string, AbortController>());
  const cancelController = useRef<AbortController | null>(null);
  const jobsRefreshRequest = useRef<JobsRefreshRequest | null>(null);
  const localJobIds = useRef(new Set<string>());

  const updateJob = useCallback((jobId: string, update: JobUpdate): void => {
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== jobId) {
          return job;
        }
        return typeof update === 'function'
          ? update(job)
          : { ...job, ...update };
      }),
    );
  }, []);

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

  const refreshJobs = useCallback((): Promise<void> => {
    const inFlight = jobsRefreshRequest.current;
    if (inFlight) {
      return inFlight.promise;
    }

    const controller = new AbortController();
    setRefreshingJobs(true);
    const promise = listTrouteJobs(RECENT_JOB_LIMIT, controller.signal)
      .then((history) => {
        if (!controller.signal.aborted) {
          const incomingIds = new Set(history.map((item) => item.state.job_id));
          incomingIds.forEach((jobId) => localJobIds.current.delete(jobId));
          setJobs((current) =>
            mergeRecentJobs(current, history, localJobIds.current),
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
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          console.error('저장된 troute Job 목록을 불러오지 못했습니다.', cause);
        }
      })
      .finally(() => {
        if (jobsRefreshRequest.current?.controller === controller) {
          jobsRefreshRequest.current = null;
          setRefreshingJobs(false);
        }
      });

    jobsRefreshRequest.current = { controller, promise };
    return promise;
  }, []);

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
    void refreshJobs();
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void refreshJobs();
      }
    }, JOB_LIST_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = (): void => {
      if (!document.hidden) {
        void refreshJobs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const inFlight = jobsRefreshRequest.current;
      jobsRefreshRequest.current = null;
      inFlight?.controller.abort();
    };
  }, [refreshJobs]);

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
      updateJob(request.job_id, (job) => ({
        ...job,
        status: 'running',
        stage: 'accepted',
        message: 'Trasolve gateway 요청을 실행하고 있습니다.',
      }));

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
          return gatewayError && isDefinitiveGatewayRejection(result.httpStatus)
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

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const selectedActiveJobId =
    selectedJob?.status === 'pending' || selectedJob?.status === 'running'
      ? selectedJob.id
      : null;

  useEffect(() => {
    if (selectedActiveJobId === null) {
      return;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async (jobId: string): Promise<void> => {
      const pairId = createTimelineId();
      const startedAt = performance.now();
      const path = `${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(jobId)}`;
      appendTimeline(jobId, {
        id: createTimelineId(),
        pairId,
        timestamp: Date.now(),
        direction: 'REQUEST',
        source: 'testbed',
        target: 'trasolve',
        method: 'GET',
        path,
        query: {},
        raw: '',
      });

      try {
        const nextJob = await getTrouteJob(jobId, controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        const latencyMs = performance.now() - startedAt;
        const raw = JSON.stringify(nextJob, null, 2);
        updateJob(jobId, (job) => {
          const merged = shouldPreserveTerminalState(job, nextJob)
            ? job
            : applyBackendJobState(job, nextJob);
          return {
            ...merged,
            inspectionError: undefined,
            timeline: [
              ...merged.timeline,
              {
                id: createTimelineId(),
                pairId,
                timestamp: Date.now(),
                direction: 'RESPONSE',
                source: 'trasolve',
                target: 'testbed',
                latencyMs,
                body: nextJob,
                raw,
              },
            ],
          };
        });

        if (isTrouteJobTerminalStatus(nextJob.status)) {
          return;
        }
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }
        const latencyMs = performance.now() - startedAt;
        const message =
          cause instanceof Error
            ? cause.message
            : 'troute Job 상태를 조회할 수 없습니다.';
        updateJob(jobId, (job) => ({
          ...job,
          inspectionError:
            gatewayControllers.current.has(jobId) ||
            isTrouteJobTerminalStatus(job.status)
              ? undefined
              : message,
          timeline: [
            ...job.timeline,
            {
              id: createTimelineId(),
              pairId,
              timestamp: Date.now(),
              direction: 'RESPONSE',
              source: 'trasolve',
              target: 'testbed',
              latencyMs,
              error: message,
            },
          ],
        }));
      }

      timer = setTimeout(
        () => void poll(jobId),
        ACTIVE_JOB_REFRESH_INTERVAL_MS,
      );
    };

    void poll(selectedActiveJobId);
    return () => {
      controller.abort();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [appendTimeline, selectedActiveJobId, updateJob]);

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
        if (!error && cancelledState) {
          gatewayControllers.current.get(jobId)?.abort();
          setHealth('online');
          updateJob(jobId, (job) =>
            applyBackendJobState(job, cancelledState, responseEntry),
          );
          setCancelDialogJobId(null);
          return;
        }

        if (result.httpStatus >= 500) {
          setHealth('offline');
        }

        let latestState: TrouteJobState | null = null;
        if (result.httpStatus === 409) {
          try {
            latestState = await getTrouteJob(jobId, controller.signal);
          } catch {
            // The cancel response remains the primary diagnostic.
          }
        }

        updateJob(jobId, (job) => {
          const current = latestState
            ? applyBackendJobState(job, latestState)
            : job;
          return {
            ...current,
            cancelError:
              result.httpStatus === 409 &&
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

  function createJob(request: TrouteOptimizeRequest): void {
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
  }

  return (
    <div
      className={`app-shell troute-testbed-shell ${resolvedTheme === 'dark' ? Classes.DARK : ''}`}
      data-theme={resolvedTheme}
    >
      <AppHeader
        health={health}
        themeMode={themeMode}
        onRefreshHealth={() => void refreshHealth()}
        onThemeChange={setThemeMode}
      />

      <main className="job-workspace">
        <JobSidebar
          jobs={jobs}
          selectedJobId={selectedJobId}
          refreshing={refreshingJobs}
          onNewJob={() => setNewJobOpen(true)}
          onRefresh={() => void refreshJobs()}
          onSelect={setSelectedJobId}
        />
        <JobDetail
          job={selectedJob}
          cancelling={selectedJob?.id === cancellingJobId}
          onRequestCancel={setCancelDialogJobId}
        />
      </main>

      <CancelJobDialog
        isOpen={cancelDialogJobId !== null}
        loading={cancelDialogJobId === cancellingJobId}
        dark={resolvedTheme === 'dark'}
        onCancel={() => {
          if (cancellingJobId === null) {
            setCancelDialogJobId(null);
          }
        }}
        onConfirm={() => {
          if (cancelDialogJobId !== null && cancellingJobId === null) {
            void cancelJob(cancelDialogJobId);
          }
        }}
      />

      {newJobOpen ? (
        <Suspense fallback={null}>
          <JobBuilderDialog
            isOpen
            dark={resolvedTheme === 'dark'}
            existingJobIds={existingJobIds}
            onClose={() => setNewJobOpen(false)}
            onCreate={createJob}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function isDefinitiveGatewayRejection(httpStatus: number): boolean {
  return httpStatus >= 400 && httpStatus < 500;
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

function describeGatewayError(result: TrouteGatewayResult): string {
  if (result.httpStatus >= 400) {
    return describeHttpError(result);
  }
  if (!result.optimization) {
    return `응답 검증 실패: ${result.responseValidationError ?? '성공 응답이 troute 계약과 일치하지 않습니다.'}`;
  }
  return '';
}

function describeHttpError(result: TrouteGatewayResult): string {
  const body = result.responseBody;
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const detail = body.error;
    if (typeof detail === 'object' && detail !== null) {
      const code = 'code' in detail ? String(detail.code) : null;
      const message = 'message' in detail ? String(detail.message) : null;
      const upstreamStatus =
        'upstreamStatus' in detail ? Number(detail.upstreamStatus) : null;
      return [
        `HTTP ${result.httpStatus}`,
        code,
        message,
        Number.isFinite(upstreamStatus)
          ? `upstream HTTP ${upstreamStatus}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
  }
  return `Trasolve backend가 HTTP ${result.httpStatus} 응답을 반환했습니다.`;
}

function describeJobError(job: TrouteJobState): string {
  if (!job.error) {
    return '';
  }
  return [job.error.code, job.error.message, job.error.detail]
    .filter(Boolean)
    .join(' · ');
}

function describeCancelError(result: TrouteCancelGatewayResult): string {
  if (result.httpStatus >= 400) {
    const body = result.responseBody;
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const detail = body.error;
      if (typeof detail === 'object' && detail !== null) {
        const code = 'code' in detail ? String(detail.code) : null;
        const message = 'message' in detail ? String(detail.message) : null;
        return [`HTTP ${result.httpStatus}`, code, message]
          .filter(Boolean)
          .join(' · ');
      }
    }
    return `Job 강제 종료 요청이 HTTP ${result.httpStatus}로 실패했습니다.`;
  }
  if (!result.jobState || result.jobState.status !== 'cancelled') {
    return 'Job 강제 종료 응답 형식이 올바르지 않습니다.';
  }
  return '';
}

function applyBackendJobState(
  job: TestbedJob,
  state: TrouteJobState,
  timelineEntry?: TimelineEntry,
): TestbedJob {
  return {
    ...job,
    status: state.status,
    progress: state.progress,
    stage: state.stage ?? undefined,
    message: state.last_message ?? job.message,
    error: state.error ? describeJobError(state) : undefined,
    inspectionError: undefined,
    cancelError: undefined,
    jobState: state,
    completedAt: isTrouteJobTerminalStatus(state.status)
      ? (job.completedAt ?? Date.now())
      : job.completedAt,
    timeline: timelineEntry ? [...job.timeline, timelineEntry] : job.timeline,
  };
}

function shouldPreserveTerminalState(
  job: TestbedJob,
  state: TrouteJobState,
): boolean {
  return (
    isTrouteJobTerminalStatus(job.status) &&
    !isTrouteJobTerminalStatus(state.status)
  );
}

function mergeRecentJobs(
  current: TestbedJob[],
  history: TrouteJobHistoryItem[],
  localJobIds: ReadonlySet<string>,
): TestbedJob[] {
  const currentById = new Map(current.map((job) => [job.id, job]));
  const incomingIds = new Set(history.map((item) => item.state.job_id));
  const merged = history.map((item) => {
    const existing = currentById.get(item.state.job_id);
    return existing
      ? mergeHistoryItemIntoJob(existing, item)
      : historyItemToTestbedJob(item);
  });
  const localOnly = current.filter(
    (job) => !incomingIds.has(job.id) && localJobIds.has(job.id),
  );
  return [...merged, ...localOnly].sort(
    (left, right) => right.createdAt - left.createdAt,
  );
}

function mergeHistoryItemIntoJob(
  existing: TestbedJob,
  item: TrouteJobHistoryItem,
): TestbedJob {
  if (shouldPreserveTerminalState(existing, item.state)) {
    return existing;
  }

  const merged: TestbedJob = {
    ...existing,
    status: item.state.status,
    createdAt: item.created_at,
    progress: item.state.progress,
    request: item.request,
    jobState: item.state,
    inspectionError: isTrouteJobTerminalStatus(item.state.status)
      ? undefined
      : existing.inspectionError,
  };
  if (item.completed_at === null) {
    delete merged.completedAt;
  } else {
    merged.completedAt = item.completed_at;
  }
  if (item.state.stage === null) {
    delete merged.stage;
  } else {
    merged.stage = item.state.stage;
  }
  if (item.state.last_message === null) {
    delete merged.message;
  } else {
    merged.message = item.state.last_message;
  }
  if (item.state.error === null) {
    delete merged.error;
  } else {
    merged.error = describeJobError(item.state);
  }
  return merged;
}

function historyItemToTestbedJob(item: TrouteJobHistoryItem): TestbedJob {
  return {
    id: item.state.job_id,
    status: item.state.status,
    createdAt: item.created_at,
    ...(item.completed_at === null ? {} : { completedAt: item.completed_at }),
    progress: item.state.progress,
    ...(item.state.stage === null ? {} : { stage: item.state.stage }),
    ...(item.state.last_message === null
      ? {}
      : { message: item.state.last_message }),
    ...(item.state.error === null
      ? {}
      : { error: describeJobError(item.state) }),
    request: item.request,
    jobState: item.state,
    timeline: [],
  };
}
