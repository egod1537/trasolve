import { CHAT_LIMITS, type ChatMessage } from '@trasolve/shared';
import { L } from '@/shared/i18n';

import {
  type UiChatMessage,
  type ChatThread,
} from '@/features/ai-chat/model/chatTypes';

export function createThread(
  id: string,
  messages: UiChatMessage[] = [],
): ChatThread {
  return {
    id,
    title: L('ai:mapAiPanel.createThread.title.newChat'),
    titleIsDefault: true,
    messages,
    updatedAt: Date.now(),
    archived: false,
    error: null,
  };
}

export function buildChatRequestMessages(
  messages: readonly UiChatMessage[],
): ChatMessage[] {
  return messages
    .filter((message) => message.requestContent !== null)
    .slice(-CHAT_LIMITS.messages)
    .map(({ role, content, requestContent }) => ({
      role,
      content: requestContent ?? content,
    }));
}

export function markAssistantMessagesRead(
  messages: UiChatMessage[],
): UiChatMessage[] {
  let changed = false;
  const next = messages.map((message) => {
    if (message.role !== 'assistant' || !message.unread) {
      return message;
    }
    changed = true;
    return { ...message, unread: false };
  });
  return changed ? next : messages;
}

export function replaceThreadMessages(
  threads: ChatThread[],
  threadId: string,
  messages: UiChatMessage[],
): ChatThread[] {
  const next = threads.map((thread) =>
    thread.id === threadId && thread.messages !== messages
      ? { ...thread, messages }
      : thread,
  );
  return next.some((thread, index) => thread !== threads[index])
    ? next
    : threads;
}

export function assertThreadMessageRefInvariant(
  threads: readonly ChatThread[],
  refs: ReadonlyMap<string, UiChatMessage[]>,
): void {
  if (!import.meta.env.DEV) {
    return;
  }
  for (const thread of threads) {
    const snapshot = refs.get(thread.id);
    if (!snapshot) {
      console.error('[Trasolve chat invariant] missing message snapshot', {
        threadId: thread.id,
      });
    } else if (snapshot !== thread.messages) {
      console.error('[Trasolve chat invariant] stale message snapshot', {
        threadId: thread.id,
        refMessageCount: snapshot.length,
        stateMessageCount: thread.messages.length,
      });
    }
  }
}
