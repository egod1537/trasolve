import { CHAT_LIMITS, type ChatMessage } from '@trasolve/shared';
import { L, type Localize } from '@/shared/i18n';

import {
  type UiChatMessage,
  type MapAiUnreadPreview,
  type ChatThread,
} from '@/features/ai-chat/model/chatTypes';
import { getThreadTitle } from '@/features/ai-chat/ui/chatPresentation';

export function createThread(id: string): ChatThread {
  return {
    id,
    title: L('ai:mapAiPanel.createThread.title.newChat'),
    titleIsDefault: true,
    messages: [],
    updatedAt: Date.now(),
    archived: false,
    error: null,
  };
}

export function getUnreadPreviews(
  threads: ChatThread[],
  localize: Localize,
): MapAiUnreadPreview[] {
  return threads
    .flatMap((thread) =>
      thread.messages.flatMap((message) =>
        message.role === 'assistant' && message.unread
          ? [
              {
                messageId: message.id,
                threadId: thread.id,
                threadTitle: getThreadTitle(thread, localize),
                content: message.content,
                createdAt: message.createdAt,
              },
            ]
          : [],
      ),
    )
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 3);
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
