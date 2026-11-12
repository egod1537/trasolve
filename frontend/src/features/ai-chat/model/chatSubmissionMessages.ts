import type { ChatResponse } from '@trasolve/shared';
import type { UiChatMessage } from './chatTypes';
import type { DebugDelayCommand } from './debugDelay';
import { buildChatRequestMessages } from './chatThreads';
import type {
  ChatSubmissionStore,
  SubmissionLogger,
  SubmittedMessages,
} from './chatSubmissionTypes';

export function appendSubmittedMessage(
  store: ChatSubmissionStore,
  threadId: string,
  content: string,
  command: DebugDelayCommand,
  log: SubmissionLogger,
): SubmittedMessages | null {
  const submittedAt = Date.now();
  const message: UiChatMessage = {
    id: `user-${store.nextMessageIdRef.current++}`,
    role: 'user',
    content,
    createdAt: submittedAt,
    unread: false,
    requestContent:
      command.kind === 'valid'
        ? command.prompt
        : command.kind === 'invalid'
          ? null
          : undefined,
  };
  const current = store.threadMessagesRef.current.get(threadId);
  if (!current) {
    logDroppedMessage(store, threadId, log);
    return null;
  }
  const messages = [...current, message];
  const requestMessages = buildChatRequestMessages(messages);
  store.threadMessagesRef.current.set(threadId, messages);
  log('USER_MESSAGE_APPENDED', { messageCount: messages.length });
  store.setThreads((threads) =>
    threads.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            messages,
            updatedAt: submittedAt,
            error: command.kind === 'invalid' ? command.error : null,
          }
        : thread,
    ),
  );
  store.draftsRef.current = { ...store.draftsRef.current, [threadId]: '' };
  store.setDrafts(store.draftsRef.current);
  return requestMessages;
}

export function appendChatAnswer(
  store: ChatSubmissionStore,
  threadId: string,
  result: ChatResponse,
  context: string | undefined,
  log: SubmissionLogger,
): void {
  const completedAt = Date.now();
  const message: UiChatMessage = {
    ...result.message,
    ...(result.followUps ? { followUps: result.followUps } : {}),
    ...(result.summary ? { summary: result.summary } : {}),
    ...(result.webImages ? { webImages: result.webImages } : {}),
    id: `assistant-${store.nextMessageIdRef.current++}`,
    createdAt: completedAt,
    unread:
      !store.openRef.current || store.selectedThreadIdRef.current !== threadId,
    ...(context === undefined ? {} : { requestContext: context }),
  };
  let latest = store.threadMessagesRef.current.get(threadId);
  if (!latest && store.threadIdsRef.current.has(threadId)) {
    latest = store.threadsRef.current.find(
      (thread) => thread.id === threadId,
    )?.messages;
    if (latest) {
      store.threadMessagesRef.current.set(threadId, latest);
    }
  }
  if (!latest) {
    logDroppedMessage(store, threadId, log);
    return;
  }
  const messages = [...latest, message];
  store.threadMessagesRef.current.set(threadId, messages);
  log('ASSISTANT_MESSAGE_APPENDED', { messageCount: messages.length });
  store.setThreads((threads) =>
    threads.map((thread) =>
      thread.id === threadId
        ? { ...thread, messages, updatedAt: completedAt }
        : thread,
    ),
  );
}

function logDroppedMessage(
  store: ChatSubmissionStore,
  threadId: string,
  log: SubmissionLogger,
) {
  log('REQUEST_DROPPED', {
    reason: store.threadIdsRef.current.has(threadId)
      ? 'missing-message-snapshot'
      : 'thread-deleted',
  });
}
