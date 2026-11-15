import { TcacheApiError, type TcacheRouteSseEvent } from '@/api/tcache';
import {
  getTcacheRouteEventsPath,
  parseTcacheRouteJobEvent,
} from '@/features/tcache-route-testbed/api/tcacheRoute';
import type { TcacheRouteJob } from '@/features/tcache-route-testbed/model/types';
import { L } from '@/shared/i18n';
import {
  mergePartialState,
  mergeRequestMetadata,
} from '@/features/tcache-route-testbed/model/tcacheJobMerge';
import {
  unwrapEventPayload,
  readEventError,
  safeJson,
} from '@/features/tcache-route-testbed/model/tcacheEventPayload';
export {
  unwrapEventPayload,
  normalizeEventStatus,
  readEventString,
  readEventNumber,
  readEventError,
  safeJson,
  isRecord,
} from '@/features/tcache-route-testbed/model/tcacheEventPayload';

export function applyStreamEvent(
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
      error:
        readEventError(payload) ??
        L(
          'testbed:tcacheRouteTestbed.applyStreamEvent.error.tcacheRouteJobFailed',
        ),
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

export function abortableDelay(
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

export function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : L('testbed:tcacheRouteTestbed.errorMessage.text.unknownErrorOccurred');
}

export function isConnectivityFailure(cause: unknown): boolean {
  return (
    !(cause instanceof TcacheApiError) ||
    cause.httpStatus === 0 ||
    cause.httpStatus >= 500
  );
}
