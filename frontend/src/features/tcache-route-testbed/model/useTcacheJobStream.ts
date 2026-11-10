const FALLBACK_POLL_MS = 1_000;
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 5_000] as const;
import { useEffect } from 'react';
import { type TcacheRouteSseEvent } from '@/api/tcache';
import {
  getTcacheRouteEventsPath,
  getTcacheRouteJob,
  subscribeTcacheRouteEvents,
} from '@/features/tcache-route-testbed/api/tcacheRoute';
import type {
  TcacheRouteJob,
  TcacheStreamState,
} from '@/features/tcache-route-testbed/model/types';
import { isActiveTcacheJob } from '@/features/tcache-route-testbed/model/types';

import { L } from '@/shared/i18n';

import {
  applyStreamEvent,
  abortableDelay,
  errorMessage,
} from '@/features/tcache-route-testbed/model/tcacheJobEvents';
import type { Dispatch, SetStateAction } from 'react';
type StreamDependencies = {
  selectedActiveJobId: string | null;
  applyJob: (job: TcacheRouteJob) => void;
  updateJob: (
    id: string,
    update: (job: TcacheRouteJob) => TcacheRouteJob,
  ) => void;
  requestResult: (id: string) => Promise<void>;
  setStreamConnection: Dispatch<
    SetStateAction<{ jobId: string; state: TcacheStreamState } | null>
  >;
};
export function useTcacheJobStream({
  selectedActiveJobId,
  applyJob,
  updateJob,
  requestResult,
  setStreamConnection,
}: StreamDependencies) {
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
            label: L('testbed:tcacheRouteTestbed.label.sseReconnect'),
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
                    label: L('testbed:tcacheRouteTestbed.label.sseOpen'),
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
          throw new Error(
            L(
              'testbed:tcacheRouteTestbed.errorMessage.text.unknownErrorOccurred',
            ),
          );
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
                label: L('testbed:tcacheRouteTestbed.label.sseDisconnect'),
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
  }, [
    applyJob,
    requestResult,
    selectedActiveJobId,
    updateJob,
    setStreamConnection,
  ]);
}
