import { CHAT_LIMITS, type ChatStreamEvent } from '@trasolve/shared';

export type PendingChatResponse = {
  requestId: string;
  content: string;
  summary: string;
  stage: 'waiting' | 'generating';
};

// Bound Markdown/layout work to 20 publications per second, regardless of SSE
// token frequency. The final response remains authoritative for saved messages.
export function createChatStreamBuffer(
  initial: PendingChatResponse,
  publish: (snapshot: PendingChatResponse) => void,
) {
  let snapshot = initial;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!closed) {
      publish(snapshot);
    }
  };
  return {
    accept(event: ChatStreamEvent) {
      if (closed) {
        return;
      }
      if (event.type === 'text') {
        snapshot = {
          ...snapshot,
          content: (snapshot.content + event.text).slice(
            0,
            CHAT_LIMITS.messageLength,
          ),
        };
      } else if (event.type === 'summary') {
        snapshot = {
          ...snapshot,
          summary: (snapshot.summary + event.text).slice(0, 8000),
        };
      } else if (event.type === 'status') {
        snapshot = { ...snapshot, stage: event.stage };
      } else {
        return;
      }
      if (timer === null) {
        timer = setTimeout(flush, 50);
      }
    },
    cancel() {
      closed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
