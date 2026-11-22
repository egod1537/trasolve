import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CHAT_LIMITS,
  type ChatRequest,
  type ChatToolProgress,
} from '@trasolve/shared';
import { streamChat } from '../api/chatStream';
import {
  createChatStreamBuffer,
  type PendingChatResponse,
} from './chatStreamBuffer';
export type { PendingChatResponse } from './chatStreamBuffer';

export function useChatV2Transport() {
  const [pending, setPending] = useState<Record<string, PendingChatResponse>>(
    {},
  );
  const buffers = useRef(new Map<string, () => void>());
  useEffect(() => {
    const active = buffers.current;
    return () => {
      for (const cancel of active.values()) {
        cancel();
      }
      active.clear();
    };
  }, []);
  const sendRequest = useCallback(
    async (request: ChatRequest, signal: AbortSignal, threadId: string) => {
      signal.throwIfAborted();
      const requestId = crypto.randomUUID();
      const initial: PendingChatResponse = {
        requestId,
        content: '',
        summary: '',
        toolProgress: [],
      };
      const buffer = createChatStreamBuffer(initial, (snapshot) => {
        if (!signal.aborted) {
          setPending((current) =>
            current[threadId]?.requestId === requestId
              ? { ...current, [threadId]: snapshot }
              : current,
          );
        }
      });
      buffers.current.set(requestId, buffer.cancel);
      const clear = () => {
        buffer.cancel();
        buffers.current.delete(requestId);
        setPending((current) => {
          if (current[threadId]?.requestId !== requestId) {
            return current;
          }
          const next = { ...current };
          delete next[threadId];
          return next;
        });
      };
      setPending((current) => ({ ...current, [threadId]: initial }));
      signal.addEventListener('abort', clear, { once: true });
      try {
        const result = await streamChat(request, signal, buffer.accept);
        signal.throwIfAborted();
        const snapshot = buffer.getSnapshot();
        const toolProgress = snapshot.toolProgress.filter(
          ({ status }) => status !== 'running',
        );
        if (
          result.toolCall &&
          !toolProgress.some(
            ({ tool, status }) =>
              tool === result.toolCall?.name && status === 'completed',
          )
        ) {
          const plan: ChatToolProgress = {
            tool: result.toolCall.name,
            index: 0,
            status: 'completed',
          };
          toolProgress.splice(CHAT_LIMITS.toolProgress - 1, 1);
          toolProgress.push(plan);
        }
        const summary = result.summary?.trim() || snapshot.summary.trim();
        return {
          ...result,
          ...(summary ? { summary } : {}),
          ...(toolProgress.length ? { toolProgress } : {}),
        };
      } finally {
        signal.removeEventListener('abort', clear);
        clear();
      }
    },
    [],
  );
  return { pending, sendRequest };
}
