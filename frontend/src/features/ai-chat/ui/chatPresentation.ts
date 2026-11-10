import { getLanguage, L, type Localize } from '@/shared/i18n';

import { type ChatThread } from '@/features/ai-chat/model/chatTypes';

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
