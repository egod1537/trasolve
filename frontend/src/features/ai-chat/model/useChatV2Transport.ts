import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatRequest } from '@trasolve/shared';
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
        stage: 'waiting',
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
        return await streamChat(request, signal, buffer.accept);
      } finally {
        signal.removeEventListener('abort', clear);
        clear();
      }
    },
    [],
  );
  return { pending, sendRequest };
}
