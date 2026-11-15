const JOB_LIST_POLL_MS = 2_000;
import { useTcacheJobStream } from '@/features/tcache-route-testbed/model/useTcacheJobStream';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TcacheApiError } from '@/api/tcache';
import {
  cancelTcacheRouteJob,
  checkTcacheRouteHealth,
  createTcacheRouteJob,
  getTcacheRouteJob,
  getTcacheRouteJobPath,
  getTcacheRouteResult,
  listTcacheRouteJobs,
} from '@/features/tcache-route-testbed/api/tcacheRoute';

import type {
  TcacheHealthState,
  TcacheRouteJob,
  TcacheRouteRequest,
  TcacheStreamState,
} from '@/features/tcache-route-testbed/model/types';
import { isActiveTcacheJob } from '@/features/tcache-route-testbed/model/types';
import { useTheme } from '@/shared/theme/useTheme';
import { L } from '@/shared/i18n';
import {
  mergeJob,
  mergeJobList,
} from '@/features/tcache-route-testbed/model/tcacheJobMerge';
import {
  errorMessage,
  isConnectivityFailure,
} from '@/features/tcache-route-testbed/model/tcacheJobEvents';

export function useTcacheTestbed() {
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
      if (controller.signal.aborted) {
        return;
      }
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
            label: L('testbed:tcacheRouteTestbed.label.resultRequest'),
            path,
          },
        ],
      }));
      try {
        const response = await getTcacheRouteResult(jobId, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
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
              label: L('testbed:tcacheRouteTestbed.label.resultResponse'),
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
                label: L('testbed:tcacheRouteTestbed.label.resultError'),
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
  useTcacheJobStream({
    selectedActiveJobId,
    applyJob,
    updateJob,
    requestResult,
    setStreamConnection,
  });
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
      if (controller.signal.aborted) {
        return;
      }
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
      if (controller.signal.aborted) {
        return;
      }
      applyJob(job);
      setCancelJobId(null);
      setHealth('online');
    } catch (cause) {
      if (controller.signal.aborted) {
        return;
      }
      if (cause instanceof TcacheApiError && cause.httpStatus === 409) {
        try {
          const latest = await getTcacheRouteJob(
            cancelJobId,
            controller.signal,
          );
          if (!controller.signal.aborted) {
            applyJob(latest);
          }
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
  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
    health,
    jobs,
    selectedJobId,
    setSelectedJobId,
    refreshing,
    listError,
    builderOpen,
    setBuilderOpen,
    builderError,
    setBuilderError,
    submitting,
    cancelJobId,
    setCancelJobId,
    cancelling,
    selectedJob,
    visibleStreamState,
    refreshHealth,
    refreshJobs,
    createJob,
    confirmCancel,
  };
}
