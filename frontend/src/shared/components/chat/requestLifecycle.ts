export type ThreadRequestLifecycleStage =
  | 'REQUEST_CREATED'
  | 'USER_MESSAGE_APPENDED'
  | 'DELAY_STARTED'
  | 'DELAY_FINISHED'
  | 'SEND_CHAT_STARTED'
  | 'SEND_CHAT_RESOLVED'
  | 'ASSISTANT_MESSAGE_APPENDED'
  | 'REQUEST_FINISHED'
  | 'REQUEST_ABORTED'
  | 'REQUEST_DROPPED';

type ThreadRequestLifecycleContext = {
  requestId: string;
  threadId: string;
  selectedThreadId: string;
  controller: AbortController;
  startedAt?: number;
  messageCount?: number;
  reason?: unknown;
};

function formatAbortReason(reason: unknown): string | undefined {
  if (typeof reason === 'string') return reason;
  if (reason instanceof Error) return reason.message;
  return reason === undefined ? undefined : String(reason);
}

export function logThreadRequestLifecycle(
  stage: ThreadRequestLifecycleStage,
  context: ThreadRequestLifecycleContext,
): void {
  if (!import.meta.env.DEV) return;

  const now = Date.now();
  const entry = {
    stage,
    requestId: context.requestId,
    threadId: context.threadId,
    selectedThreadId: context.selectedThreadId,
    aborted: context.controller.signal.aborted,
    timestamp: new Date(now).toISOString(),
    ...(context.startedAt === undefined
      ? {}
      : { elapsedMs: now - context.startedAt }),
    ...(context.messageCount === undefined
      ? {}
      : { messageCount: context.messageCount }),
    ...(context.reason === undefined
      ? {}
      : { reason: formatAbortReason(context.reason) }),
  };

  if (stage === 'REQUEST_ABORTED' || stage === 'REQUEST_DROPPED') {
    console.warn('[Trasolve chat request]', entry);
  } else {
    console.debug('[Trasolve chat request]', entry);
  }
}
