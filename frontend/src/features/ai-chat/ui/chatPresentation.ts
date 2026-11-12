import { getLanguage, L, type Localize } from '@/shared/i18n';

import {
  type ChatThread,
  type MapAiUnreadPreview,
} from '@/features/ai-chat/model/chatTypes';

export function getThreadTitle(thread: ChatThread, localize: Localize): string {
  return thread.titleIsDefault
    ? localize('ai:mapAiPanel.createThread.title.newChat')
    : thread.title;
}

export function formatRelativeTime(timestamp: number): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60000),
  );
  if (elapsedMinutes < 1) {
    return L('ai:mapAiPanel.formatRelativeTime.text.justNow');
  }
  if (elapsedMinutes < 60) {
    return L('ai:mapAiPanel.formatRelativeTime.text.minutesAgo', {
      elapsedMinutes: elapsedMinutes,
    });
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return L('ai:mapAiPanel.formatRelativeTime.text.hoursAgo', {
      elapsedHours: elapsedHours,
    });
  }
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7
    ? L('ai:mapAiPanel.formatRelativeTime.text.daysAgo', {
        elapsedDays: elapsedDays,
      })
    : new Intl.DateTimeFormat(getLanguage(), {
        month: 'short',
        day: 'numeric',
      }).format(timestamp);
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
