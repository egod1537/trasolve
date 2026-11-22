import {
  CHAT_LIMITS,
  type ChatStreamEvent,
  type ChatToolProgress,
} from '@trasolve/shared';

export type PendingChatResponse = {
  requestId: string;
  content: string;
  summary: string;
  stage?: 'waiting' | 'generating';
  toolProgress: readonly ChatToolProgress[];
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
        if (
          snapshot.stage === event.stage ||
          (snapshot.stage === 'generating' && event.stage === 'waiting')
        ) {
          return;
        }
        snapshot = { ...snapshot, stage: event.stage };
      } else if (event.type === 'tool') {
        const progress: ChatToolProgress = {
          tool: event.tool,
          index: event.index,
          status: event.status,
        };
        const tools = updateToolProgress(snapshot.toolProgress, progress);
        if (tools === snapshot.toolProgress) {
          return;
        }
        snapshot = { ...snapshot, toolProgress: tools };
      } else {
        return;
      }
      if (timer === null) {
        timer = setTimeout(flush, 50);
      }
    },
    getSnapshot: () => snapshot,
    cancel() {
      closed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

function updateToolProgress(
  current: readonly ChatToolProgress[],
  progress: ChatToolProgress,
): readonly ChatToolProgress[] {
  const index = current.findIndex(
    (item) => item.tool === progress.tool && item.index === progress.index,
  );
  if (index < 0) {
    return current.length < CHAT_LIMITS.toolProgress
      ? [...current, progress]
      : current;
  }
  if (current[index].status !== 'running' || progress.status === 'running') {
    return current;
  }
  return current.map((item, position) =>
    position === index ? progress : item,
  );
}
