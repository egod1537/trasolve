import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isTrouteJobTerminalStatus,
  type TrouteJobState,
} from '@trasolve/shared';
import {
  getTrouteJob,
  getTrouteJobEventPath,
  parseTrouteJobEvent,
  type TrouteJobEventType,
} from '@/features/troute-testbed/api/troute';

const EVENT_TYPES: readonly TrouteJobEventType[] = [
  'snapshot',
  'progress',
  'completed',
  'failed',
  'cancelled',
];

export type TrouteJobEventStreamStatus =
  'idle' | 'connecting' | 'open' | 'retrying' | 'paused' | 'closed';

export type TrouteJobObservation = {
  source: 'initial' | 'resume' | 'event';
  receivedAt: number;
  updatedAt?: number;
  sequence?: number;
  eventType?: TrouteJobEventType;
  eventId?: string;
  rawData?: string;
};

type Options = {
  onJob?: (job: TrouteJobState, observation: TrouteJobObservation) => void;
};

type StreamState = {
  jobId: string | null;
  status: TrouteJobEventStreamStatus;
  error: string | null;
};

export function useTrouteJobEventStream(
  jobId: string | null,
  { onJob }: Options = {},
) {
  const [state, setState] = useState<StreamState>({
    jobId,
    status: jobId === null ? 'idle' : 'connecting',
    error: null,
  });
  const resyncRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const resync = useCallback(() => resyncRef.current(), []);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    let controller: AbortController | null = null;
    let currentJob: TrouteJobState | null = null;
    let latestRequest = 0;
    let latestSequence = -1;
    const appliedEventIds = new Set<string>();

    const updateState = (
      status: TrouteJobEventStreamStatus,
      error: string | null = null,
    ): void => {
      if (disposed) {
        return;
      }
      setState((current) =>
        current.jobId === jobId &&
        current.status === status &&
        current.error === error
          ? current
          : { jobId, status, error },
      );
    };
    const closeSource = (): void => {
      source?.close();
      source = null;
    };
    const applyEvent = (
      type: TrouteJobEventType,
      event: MessageEvent<string>,
    ): void => {
      if (disposed || jobId === null) {
        return;
      }
      if (event.lastEventId && appliedEventIds.has(event.lastEventId)) {
        return;
      }

      try {
        const parsed = parseTrouteJobEvent(type, event.data);
        if (parsed.state.job_id !== jobId) {
          throw new Error('선택한 Job과 SSE event의 Job ID가 다릅니다.');
        }
        if (
          parsed.sequence !== undefined &&
          parsed.sequence <= latestSequence
        ) {
          return;
        }
        if (event.lastEventId) {
          appliedEventIds.add(event.lastEventId);
        }
        if (parsed.sequence !== undefined) {
          latestSequence = parsed.sequence;
        }

        currentJob = parsed.state;
        const receivedAt = Date.now();
        onJob?.(parsed.state, {
          source: 'event',
          receivedAt,
          updatedAt: parsed.updatedAt ?? receivedAt,
          ...(parsed.sequence === undefined
            ? {}
            : { sequence: parsed.sequence }),
          eventType: type,
          ...(event.lastEventId ? { eventId: event.lastEventId } : {}),
          rawData: event.data,
        });
        updateState('open');
        if (isTrouteJobTerminalStatus(parsed.state.status)) {
          closeSource();
          updateState('closed');
        }
      } catch (cause) {
        updateState(
          'retrying',
          cause instanceof Error
            ? cause.message
            : 'Job 실시간 event를 처리할 수 없습니다.',
        );
      }
    };
    const connect = (): void => {
      if (
        disposed ||
        jobId === null ||
        document.hidden ||
        source !== null ||
        (currentJob !== null && isTrouteJobTerminalStatus(currentJob.status))
      ) {
        return;
      }

      updateState('connecting');
      const nextSource = new EventSource(getTrouteJobEventPath(jobId));
      source = nextSource;
      nextSource.onopen = () => updateState('open');
      nextSource.onerror = () => {
        if (!disposed && source === nextSource) {
          updateState('retrying', '실시간 연결이 끊겨 다시 연결하고 있습니다.');
        }
      };
      for (const type of EVENT_TYPES) {
        nextSource.addEventListener(type, (event) =>
          applyEvent(type, event as MessageEvent<string>),
        );
      }
    };
    const synchronize = async (
      sourceType: 'initial' | 'resume',
    ): Promise<void> => {
      if (disposed || jobId === null || document.hidden) {
        return;
      }

      const requestId = ++latestRequest;
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      updateState('connecting');
      try {
        const job = await getTrouteJob(jobId, requestController.signal);
        if (
          disposed ||
          requestController.signal.aborted ||
          requestId !== latestRequest
        ) {
          return;
        }
        currentJob = job;
        onJob?.(job, { source: sourceType, receivedAt: Date.now() });
        if (isTrouteJobTerminalStatus(job.status)) {
          closeSource();
          updateState('closed');
          return;
        }
        connect();
      } catch (cause) {
        if (disposed || requestController.signal.aborted) {
          return;
        }
        updateState(
          'retrying',
          cause instanceof Error
            ? cause.message
            : 'Job 상태를 다시 동기화할 수 없습니다.',
        );
        connect();
      } finally {
        if (controller === requestController) {
          controller = null;
        }
      }
    };

    resyncRef.current = () => synchronize('resume');
    if (jobId !== null) {
      void synchronize('initial');
    }

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        latestRequest += 1;
        controller?.abort();
        controller = null;
        closeSource();
        updateState('paused');
        return;
      }
      void synchronize('resume');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      latestRequest += 1;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      controller?.abort();
      controller = null;
      closeSource();
      resyncRef.current = () => Promise.resolve();
    };
  }, [jobId, onJob]);

  return state.jobId === jobId
    ? { status: state.status, error: state.error, resync }
    : {
        status: jobId === null ? ('idle' as const) : ('connecting' as const),
        error: null,
        resync,
      };
}
