import { Classes } from '@blueprintjs/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TcacheApiError, type TcacheRouteSseEvent } from '@/api/tcache';
import {
  cancelTcacheRouteJob,
  checkTcacheRouteHealth,
  createTcacheRouteJob,
  getTcacheRouteEventsPath,
  getTcacheRouteJob,
  getTcacheRouteJobPath,
  getTcacheRouteResult,
  listTcacheRouteJobs,
  parseTcacheRouteJobEvent,
  subscribeTcacheRouteEvents,
} from '@/features/tcache-route-testbed/api/tcacheRoute';
import { AppHeader } from '@/features/tcache-route-testbed/components/AppHeader';
import { CancelJobDialog } from '@/features/tcache-route-testbed/components/detail/CancelJobDialog';
import { JobDetail } from '@/features/tcache-route-testbed/components/detail/JobDetail';
import { JobSidebar } from '@/features/tcache-route-testbed/components/jobs/JobSidebar';
import { TcacheJobBuilderDialog } from '@/features/tcache-route-testbed/job-builder/TcacheJobBuilderDialog';
import type {
  TcacheHealthState,
  TcacheRouteJob,
  TcacheRouteRequest,
  TcacheStreamState,
} from '@/features/tcache-route-testbed/model/types';
import { isActiveTcacheJob } from '@/features/tcache-route-testbed/model/types';
import { useTheme } from '@/shared/theme/useTheme';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@/features/tcache-route-testbed/tcache-route-testbed.css';

const JOB_LIST_POLL_MS = 2_000;
const FALLBACK_POLL_MS = 1_000;
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 5_000] as const;

export function TcacheRouteTestbed() {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const [health, setHealth] = useState<TcacheHealthState>('checking');
  const [jobs, setJobs] = useState<TcacheRouteJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [streamConnection, setStreamConnection] = useState<{
    jobId: string;
    state: TcacheStreamState;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelJobId, setCancelJobId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const listController = useRef<AbortController | null>(null);
  const healthController = useRef<AbortController | null>(null);
  const createController = useRef<AbortController | null>(null);
  const cancelController = useRef<AbortController | null>(null);
  const resultControllers = useRef(new Map<string, AbortController>());
  const resultRequestIds = useRef(new Set<string>());
  const localJobIds = useRef(new Set<string>());

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );
  const selectedActiveJobId =
    selectedJob && isActiveTcacheJob(selectedJob) ? selectedJob.id : null;
  const visibleStreamState = selectedActiveJobId
    ? streamConnection?.jobId !== selectedActiveJobId
      ? 'connecting'
      : streamConnection.state
    : 'idle';

  const applyJob = useCallback((incoming: TcacheRouteJob): void => {
    setJobs((current) => mergeJob(current, incoming));
  }, []);

  const updateJob = useCallback(
    (jobId: string, update: (job: TcacheRouteJob) => TcacheRouteJob): void => {
      setJobs((current) => {
        const index = current.findIndex((job) => job.id === jobId);
        if (index < 0) {
          return current;
        }
        const next = [...current];
        next[index] = update(current[index]!);
        return next;
      });
    },
    [],
  );

  const refreshHealth = useCallback(async (): Promise<void> => {
    healthController.current?.abort();
    const controller = new AbortController();
    healthController.current = controller;
    setHealth('checking');
    try {
      const online = await checkTcacheRouteHealth(controller.signal);
      setHealth(online ? 'online' : 'offline');
    } catch {
      if (!controller.signal.aborted) {
        setHealth('offline');
      }
    } finally {
      if (healthController.current === controller) {
        healthController.current = null;
      }
    }
  }, []);

  const refreshJobs = useCallback(async (): Promise<void> => {
    listController.current?.abort();
    const controller = new AbortController();
    listController.current = controller;
    setRefreshing(true);
    try {
      const incoming = await listTcacheRouteJobs(controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      const incomingIds = new Set(incoming.map((job) => job.id));
      incomingIds.forEach((jobId) => localJobIds.current.delete(jobId));
      setJobs((current) =>
        mergeJobList(current, incoming, localJobIds.current),
      );
      setSelectedJobId((current) =>
        current &&
        (incomingIds.has(current) || localJobIds.current.has(current))
          ? current
          : (incoming[0]?.id ?? null),
      );
      setListError(null);
      setHealth('online');
    } catch (cause) {
      if (controller.signal.aborted) {
        return;
      }
      setListError(errorMessage(cause));
      if (isConnectivityFailure(cause)) {
        setHealth('offline');
      }
    } finally {
      if (listController.current === controller) {
        listController.current = null;
        setRefreshing(false);
      }
    }
  }, []);

  const requestResult = useCallback(
    async (jobId: string): Promise<void> => {
      if (resultRequestIds.current.has(jobId)) {
        return;
      }
      resultRequestIds.current.add(jobId);
      const controller = new AbortController();
      resultControllers.current.set(jobId, controller);
      const pairId = crypto.randomUUID();
      const path = `${getTcacheRouteJobPath(jobId)}/result`;
      updateJob(jobId, (job) => ({
        ...job,
        timeline: [
          ...job.timeline,
          {
            id: crypto.randomUUID(),
            pairId,
            timestamp: Date.now(),
            direction: 'REQUEST',
            source: 'testbed',
            target: 'trasolve',
            method: 'GET',
            label: 'Result request',
            path,
          },
        ],
      }));
      try {
        const response = await getTcacheRouteResult(jobId, controller.signal);
        updateJob(jobId, (job) => ({
          ...job,
          result: response.result,
          timeline: [
            ...job.timeline,
            {
              id: crypto.randomUUID(),
              pairId,
              timestamp: Date.now(),
              direction: 'RESPONSE',
              source: 'trasolve',
              target: 'testbed',
              method: 'GET',
              label: 'Result response',
              path,
              status: response.httpStatus,
              latencyMs: response.durationMs,
              body: response.body,
            },
          ],
        }));
      } catch (cause) {
        if (!controller.signal.aborted) {
          resultRequestIds.current.delete(jobId);
          updateJob(jobId, (job) => ({
            ...job,
            timeline: [
              ...job.timeline,
              {
                id: crypto.randomUUID(),
                pairId,
                timestamp: Date.now(),
                direction: 'RESPONSE',
                source: 'trasolve',
                target: 'testbed',
                method: 'GET',
                label: 'Result error',
                path,
                error: errorMessage(cause),
              },
            ],
          }));
        }
      } finally {
        if (resultControllers.current.get(jobId) === controller) {
          resultControllers.current.delete(jobId);
        }
      }
    },
    [updateJob],
  );

  useEffect(() => {
    const activeResultControllers = resultControllers.current;
    let interval: number | null = null;
    const stop = (): void => {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    };
    const start = (): void => {
      stop();
      if (document.hidden) {
        return;
      }
      void refreshJobs();
      interval = window.setInterval(() => void refreshJobs(), JOB_LIST_POLL_MS);
    };
    const visibilityChanged = (): void => {
      if (document.hidden) {
        stop();
        listController.current?.abort();
      } else {
        start();
      }
    };
    const initialRefresh = window.setTimeout(() => {
      void refreshHealth();
      start();
    }, 0);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      window.clearTimeout(initialRefresh);
      stop();
      document.removeEventListener('visibilitychange', visibilityChanged);
      const pendingControllers = [
        listController.current,
        healthController.current,
        createController.current,
        cancelController.current,
      ];
      listController.current = null;
      healthController.current = null;
      createController.current = null;
      cancelController.current = null;
      pendingControllers.forEach((controller) => controller?.abort());
      activeResultControllers.forEach((controller) => controller.abort());
      activeResultControllers.clear();
    };
  }, [refreshHealth, refreshJobs]);

  useEffect(() => {
    if (!selectedActiveJobId) {
      return;
    }
    const jobId = selectedActiveJobId;
    let disposed = false;
    let terminal = false;
    let lastEventId: string | undefined;
    let reconnectAttempt = 0;
    let fallbackTimer: number | null = null;
    const streamController = new AbortController();

    const appendTimeline = (
      entry: TcacheRouteJob['timeline'][number],
    ): void => {
      updateJob(jobId, (job) => ({
        ...job,
        timeline: [...job.timeline, entry],
      }));
    };
    const stopFallback = (): void => {
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };
    const applyEvent = (event: TcacheRouteSseEvent): void => {
      if (event.id !== undefined) {
        lastEventId = event.id;
      }
      updateJob(jobId, (job) => applyStreamEvent(job, event));
      if (event.type === 'completed') {
        terminal = true;
        stopFallback();
        setStreamConnection({ jobId, state: 'idle' });
        void requestResult(jobId);
        streamController.abort();
      } else if (event.type === 'failed' || event.type === 'cancelled') {
        terminal = true;
        stopFallback();
        setStreamConnection({ jobId, state: 'idle' });
        streamController.abort();
      }
    };
    const pollSnapshot = async (): Promise<void> => {
      if (disposed || terminal || streamController.signal.aborted) {
        return;
      }
      try {
        const incoming = await getTcacheRouteJob(
          jobId,
          streamController.signal,
        );
        if (disposed) {
          return;
        }
        applyJob(incoming);
        if (!isActiveTcacheJob(incoming)) {
          terminal = true;
          stopFallback();
          if (incoming.status === 'completed') {
            void requestResult(jobId);
          }
          streamController.abort();
        }
      } catch {
        // The reconnect loop owns connection diagnostics.
      }
    };
    const startFallback = (): void => {
      if (fallbackTimer !== null || terminal) {
        return;
      }
      void pollSnapshot();
      fallbackTimer = window.setInterval(
        () => void pollSnapshot(),
        FALLBACK_POLL_MS,
      );
    };
    const connect = async (): Promise<void> => {
      while (!disposed && !terminal && !streamController.signal.aborted) {
        const reconnecting = reconnectAttempt > 0;
        setStreamConnection({
          jobId,
          state: reconnecting ? 'retrying' : 'connecting',
        });
        if (reconnecting) {
          appendTimeline({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            direction: 'SSE',
            source: 'testbed',
            target: 'trasolve',
            event: 'reconnect',
            label: 'SSE reconnect',
            path: getTcacheRouteEventsPath(jobId),
          });
        }
        try {
          await subscribeTcacheRouteEvents(jobId, {
            signal: streamController.signal,
            ...(lastEventId ? { lastEventId } : {}),
            onOpen: () => {
              reconnectAttempt = 0;
              stopFallback();
              setStreamConnection({ jobId, state: 'connected' });
              updateJob(jobId, (job) => ({
                ...job,
                sseState: 'connected',
                timeline: [
                  ...job.timeline,
                  {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    direction: 'SSE',
                    source: 'trasolve',
                    target: 'testbed',
                    event: 'open',
                    label: 'SSE open',
                    path: getTcacheRouteEventsPath(jobId),
                    status: 200,
                  },
                ],
              }));
            },
            onEvent: applyEvent,
          });
          if (terminal || disposed) {
            return;
          }
          throw new Error('tcache SSE 연결이 종료되었습니다.');
        } catch (cause) {
          if (disposed || terminal || streamController.signal.aborted) {
            return;
          }
          reconnectAttempt += 1;
          setStreamConnection({ jobId, state: 'retrying' });
          updateJob(jobId, (job) => ({
            ...job,
            sseState: 'retrying',
            timeline: [
              ...job.timeline,
              {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                direction: 'SSE',
                source: 'trasolve',
                target: 'testbed',
                event: 'disconnect',
                label: 'SSE disconnect',
                path: getTcacheRouteEventsPath(jobId),
                error: errorMessage(cause),
              },
            ],
          }));
          startFallback();
          const delay =
            RECONNECT_DELAYS_MS[
              Math.min(reconnectAttempt - 1, RECONNECT_DELAYS_MS.length - 1)
            ]!;
          try {
            await abortableDelay(delay, streamController.signal);
          } catch {
            return;
          }
        }
      }
    };
    const resume = (): void => {
      if (!document.hidden) {
        void pollSnapshot();
      }
    };
    document.addEventListener('visibilitychange', resume);
    const connectTimer = window.setTimeout(() => void connect(), 0);
    return () => {
      disposed = true;
      window.clearTimeout(connectTimer);
      stopFallback();
      streamController.abort();
      document.removeEventListener('visibilitychange', resume);
    };
  }, [applyJob, requestResult, selectedActiveJobId, updateJob]);

  useEffect(() => {
    if (selectedJob?.status !== 'completed' || selectedJob.result) {
      return;
    }
    const timeout = window.setTimeout(
      () => void requestResult(selectedJob.id),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, [
    requestResult,
    selectedJob?.id,
    selectedJob?.result,
    selectedJob?.status,
  ]);

  const createJob = useCallback(async (request: TcacheRouteRequest) => {
    createController.current?.abort();
    const controller = new AbortController();
    createController.current = controller;
    setSubmitting(true);
    setBuilderError(null);
    try {
      const job = await createTcacheRouteJob(request, controller.signal);
      localJobIds.current.add(job.id);
      setJobs((current) => mergeJob(current, job));
      setSelectedJobId(job.id);
      setBuilderOpen(false);
      setHealth('online');
    } catch (cause) {
      if (controller.signal.aborted) {
        return;
      }
      setBuilderError(errorMessage(cause));
      if (isConnectivityFailure(cause)) {
        setHealth('offline');
      }
    } finally {
      if (createController.current === controller) {
        createController.current = null;
        setSubmitting(false);
      }
    }
  }, []);

  const confirmCancel = useCallback(async (): Promise<void> => {
    if (!cancelJobId) {
      return;
    }
    cancelController.current?.abort();
    const controller = new AbortController();
    cancelController.current = controller;
    setCancelling(true);
    try {
      const job = await cancelTcacheRouteJob(cancelJobId, controller.signal);
      applyJob(job);
      setCancelJobId(null);
      setHealth('online');
    } catch (cause) {
      if (controller.signal.aborted) {
        return;
      }
      if (cause instanceof TcacheApiError && cause.httpStatus === 409) {
        try {
          applyJob(await getTcacheRouteJob(cancelJobId, controller.signal));
        } catch {
          // The cancel conflict remains the primary diagnostic.
        }
      }
      setListError(errorMessage(cause));
      if (isConnectivityFailure(cause)) {
        setHealth('offline');
      }
      setCancelJobId(null);
    } finally {
      if (cancelController.current === controller) {
        cancelController.current = null;
        setCancelling(false);
      }
    }
  }, [applyJob, cancelJobId]);

  return (
    <div
      className={`tcache-testbed-shell ${resolvedTheme === 'dark' ? Classes.DARK : ''}`}
      data-theme={resolvedTheme}
    >
      <AppHeader
        health={health}
        themeMode={themeMode}
        onRefresh={() => {
          void refreshHealth();
          void refreshJobs();
        }}
        onThemeChange={setThemeMode}
      />
      <main className="tcache-job-workspace">
        <JobSidebar
          jobs={jobs}
          selectedJobId={selectedJobId}
          refreshing={refreshing}
          error={listError}
          onNewJob={() => {
            setBuilderError(null);
            setBuilderOpen(true);
          }}
          onRefresh={() => void refreshJobs()}
          onSelect={setSelectedJobId}
        />
        <JobDetail
          job={selectedJob}
          streamState={visibleStreamState}
          cancelling={cancelling}
          onRequestCancel={setCancelJobId}
        />
      </main>
      <TcacheJobBuilderDialog
        isOpen={builderOpen}
        dark={resolvedTheme === 'dark'}
        submitting={submitting}
        error={builderError}
        onClose={() => {
          if (!submitting) {
            setBuilderOpen(false);
          }
        }}
        onCreate={(request) => void createJob(request)}
      />
      <CancelJobDialog
        jobId={cancelJobId}
        loading={cancelling}
        dark={resolvedTheme === 'dark'}
        onClose={() => {
          if (!cancelling) {
            setCancelJobId(null);
          }
        }}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  );
}

function mergeJob(
  current: TcacheRouteJob[],
  incoming: TcacheRouteJob,
): TcacheRouteJob[] {
  const index = current.findIndex((job) => job.id === incoming.id);
  if (index < 0) {
    return [incoming, ...current];
  }
  const existing = current[index]!;
  if (incoming.updatedAt < existing.updatedAt) {
    return current;
  }
  const timeline = [...existing.timeline, ...incoming.timeline]
    .filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.id === entry.id) === index,
    )
    .sort((left, right) => left.timestamp - right.timestamp);
  const merged = {
    ...incoming,
    request:
      incoming.request.locations.length > 0
        ? mergeRequestMetadata(existing.request, incoming.request)
        : existing.request,
    ...(incoming.result
      ? {}
      : existing.result
        ? { result: existing.result }
        : {}),
    ...(existing.sseState ? { sseState: existing.sseState } : {}),
    timeline,
  };
  const next = [...current];
  next[index] = merged;
  return next;
}

function mergeJobList(
  current: TcacheRouteJob[],
  incoming: TcacheRouteJob[],
  localJobIds: ReadonlySet<string>,
): TcacheRouteJob[] {
  return incoming
    .reduce(mergeJob, current)
    .filter(
      (job) =>
        localJobIds.has(job.id) ||
        incoming.some((remote) => remote.id === job.id),
    );
}

function applyStreamEvent(
  current: TcacheRouteJob,
  event: TcacheRouteSseEvent,
): TcacheRouteJob {
  const timestamp = Date.now();
  const parsedBody = safeJson(event.data);
  const payload = unwrapEventPayload(parsedBody);
  let next = current;

  if (event.type === 'snapshot') {
    try {
      const snapshot = parseTcacheRouteJobEvent(
        payload ? JSON.stringify(payload) : event.data,
      );
      if (snapshot.id === current.id) {
        next = {
          ...current,
          ...snapshot,
          request:
            snapshot.request.locations.length > 0
              ? mergeRequestMetadata(current.request, snapshot.request)
              : current.request,
          timeline: current.timeline,
        };
      }
    } catch {
      next = mergePartialState(current, payload, timestamp);
    }
  } else if (event.type === 'progress') {
    next = {
      ...mergePartialState(current, payload, timestamp),
      status: 'running',
    };
  } else if (event.type === 'completed') {
    next = {
      ...mergePartialState(current, payload, timestamp),
      status: 'completed',
      progress: 100,
      completedAt: timestamp,
      sseState: 'idle',
    };
  } else if (event.type === 'failed') {
    next = {
      ...mergePartialState(current, payload, timestamp),
      status: 'failed',
      completedAt: timestamp,
      sseState: 'idle',
      error: readEventError(payload) ?? 'tcache Route Job이 실패했습니다.',
    };
  } else if (event.type === 'cancelled') {
    next = {
      ...mergePartialState(current, payload, timestamp),
      status: 'cancelled',
      completedAt: timestamp,
      sseState: 'idle',
    };
  }

  return {
    ...next,
    updatedAt: Math.max(next.updatedAt, timestamp),
    timeline: [
      ...next.timeline,
      {
        id: crypto.randomUUID(),
        ...(event.id ? { pairId: event.id } : {}),
        timestamp,
        direction: 'SSE',
        source: 'trasolve',
        target: 'testbed',
        event: event.type,
        label: event.type,
        path: getTcacheRouteEventsPath(current.id),
        status: 200,
        body: parsedBody,
        raw: event.raw,
      },
    ],
  };
}

function mergePartialState(
  current: TcacheRouteJob,
  payload: Record<string, unknown> | null,
  timestamp: number,
): TcacheRouteJob {
  if (!payload) {
    return current;
  }
  const progress = readEventNumber(payload, 'progress');
  const stage = readEventString(payload, 'stage');
  const message = readEventString(payload, 'message');
  const status = normalizeEventStatus(payload.status);
  return {
    ...current,
    updatedAt: timestamp,
    ...(status ? { status } : {}),
    ...(progress === undefined
      ? {}
      : { progress: Math.max(0, Math.min(100, progress)) }),
    ...(stage ? { stage } : {}),
    ...(message ? { message } : {}),
    progressEvent: {
      stage: stage ?? current.stage ?? 'running',
      progress: progress ?? current.progress,
      ...(message ? { message } : {}),
      timestamp,
    },
  };
}

function unwrapEventPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }
  const nested = value.state ?? value.job ?? value.data;
  return isRecord(nested) ? nested : value;
}

function normalizeEventStatus(
  value: unknown,
): TcacheRouteJob['status'] | undefined {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  ) {
    return value;
  }
  if (value === 'pending' || value === 'accepted') {
    return 'queued';
  }
  return undefined;
}

function readEventString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof value[key] === 'string' ? value[key] : undefined;
}

function readEventNumber(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  return typeof value[key] === 'number' && Number.isFinite(value[key])
    ? value[key]
    : undefined;
}

function readEventError(
  value: Record<string, unknown> | null,
): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value.error === 'string') {
    return value.error;
  }
  if (isRecord(value.error) && typeof value.error.message === 'string') {
    return value.error.message;
  }
  return readEventString(value, 'message');
}

function abortableDelay(
  durationMs: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, durationMs);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : '알 수 없는 오류가 발생했습니다.';
}

function isConnectivityFailure(cause: unknown): boolean {
  return (
    !(cause instanceof TcacheApiError) ||
    cause.httpStatus === 0 ||
    cause.httpStatus >= 500
  );
}

function safeJson(value: string): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeRequestMetadata(
  local: TcacheRouteRequest,
  remote: TcacheRouteRequest,
): TcacheRouteRequest {
  return {
    ...remote,
    locations: remote.locations.map((location, index) => {
      const matching = location.placeId
        ? local.locations.find(
            (candidate) => candidate.placeId === location.placeId,
          )
        : local.locations[index];
      if (!matching) {
        return location;
      }
      const address = location.address ?? matching.address;
      const lat = location.lat ?? matching.lat;
      const lng = location.lng ?? matching.lng;
      return {
        ...location,
        id: matching.id,
        name: location.name === location.id ? matching.name : location.name,
        ...(address ? { address } : {}),
        ...(lat === undefined ? {} : { lat }),
        ...(lng === undefined ? {} : { lng }),
      };
    }),
  };
}
