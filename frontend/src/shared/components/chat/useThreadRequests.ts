import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logThreadRequestLifecycle } from './requestLifecycle';

export type ThreadRequestHandle = {
  requestId: string;
  controller: AbortController;
  startedAt: number;
};

type PendingThreadRequest = ThreadRequestHandle & {
  debugDelayPending: boolean;
};

type CancelReason = 'component-unmount' | 'explicit-cancel' | 'thread-deleted';

export function useThreadRequests(getSelectedThreadId: () => string) {
  const pendingRequestsRef = useRef(new Map<string, PendingThreadRequest>());
  const [sendingThreadIds, setSendingThreadIds] = useState<Set<string>>(
    () => new Set(),
  );

  const isThreadSending = useCallback(
    (threadId: string) => pendingRequestsRef.current.has(threadId),
    [],
  );

  const beginRequest = useCallback(
    (threadId: string) => {
      if (pendingRequestsRef.current.has(threadId)) {
        return null;
      }

      const handle: ThreadRequestHandle = {
        requestId: crypto.randomUUID(),
        controller: new AbortController(),
        startedAt: Date.now(),
      };
      pendingRequestsRef.current.set(threadId, {
        ...handle,
        debugDelayPending: false,
      });
      logThreadRequestLifecycle('REQUEST_CREATED', {
        ...handle,
        threadId,
        selectedThreadId: getSelectedThreadId(),
      });
      setSendingThreadIds((current) => {
        const next = new Set(current);
        next.add(threadId);
        return next;
      });
      return handle;
    },
    [getSelectedThreadId],
  );

  const finishRequest = useCallback(
    (threadId: string, handle: ThreadRequestHandle) => {
      const request = pendingRequestsRef.current.get(threadId);
      if (
        request?.controller !== handle.controller ||
        request.requestId !== handle.requestId
      ) {
        if (handle.controller.signal.aborted) {
          return;
        }
        logThreadRequestLifecycle('REQUEST_DROPPED', {
          ...handle,
          threadId,
          selectedThreadId: getSelectedThreadId(),
          reason: 'stale-finish',
        });
        return;
      }

      pendingRequestsRef.current.delete(threadId);
      logThreadRequestLifecycle('REQUEST_FINISHED', {
        ...handle,
        threadId,
        selectedThreadId: getSelectedThreadId(),
      });
      setSendingThreadIds((current) => {
        if (!current.has(threadId)) {
          return current;
        }
        const next = new Set(current);
        next.delete(threadId);
        return next;
      });
    },
    [getSelectedThreadId],
  );

  const setDebugDelayPending = useCallback(
    (
      threadId: string,
      handle: ThreadRequestHandle,
      debugDelayPending: boolean,
    ) => {
      const request = pendingRequestsRef.current.get(threadId);
      if (
        request?.controller === handle.controller &&
        request.requestId === handle.requestId
      ) {
        request.debugDelayPending = debugDelayPending;
        return;
      }
      if (handle.controller.signal.aborted) {
        return;
      }
      logThreadRequestLifecycle('REQUEST_DROPPED', {
        ...handle,
        threadId,
        selectedThreadId: getSelectedThreadId(),
        reason: 'stale-delay-state',
      });
    },
    [getSelectedThreadId],
  );

  const cancelThreadRequest = useCallback(
    (threadId: string, reason: CancelReason = 'explicit-cancel') => {
      const request = pendingRequestsRef.current.get(threadId);
      if (!request) {
        return;
      }

      pendingRequestsRef.current.delete(threadId);
      request.controller.abort(reason);
      logThreadRequestLifecycle('REQUEST_ABORTED', {
        ...request,
        threadId,
        selectedThreadId: getSelectedThreadId(),
        reason,
      });
      setSendingThreadIds((current) => {
        if (!current.has(threadId)) {
          return current;
        }
        const next = new Set(current);
        next.delete(threadId);
        return next;
      });
    },
    [getSelectedThreadId],
  );

  useEffect(
    () => () => {
      for (const [threadId, request] of pendingRequestsRef.current) {
        request.controller.abort('component-unmount');
        logThreadRequestLifecycle('REQUEST_ABORTED', {
          ...request,
          threadId,
          selectedThreadId: getSelectedThreadId(),
          reason: 'component-unmount',
        });
      }
      pendingRequestsRef.current.clear();
    },
    [getSelectedThreadId],
  );

  return useMemo(
    () => ({
      sendingThreadIds,
      isThreadSending,
      beginRequest,
      finishRequest,
      setDebugDelayPending,
      cancelThreadRequest,
    }),
    [
      beginRequest,
      cancelThreadRequest,
      finishRequest,
      isThreadSending,
      sendingThreadIds,
      setDebugDelayPending,
    ],
  );
}
