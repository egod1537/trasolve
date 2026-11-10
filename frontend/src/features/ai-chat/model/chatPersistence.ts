import { CHAT_LIMITS } from '@trasolve/shared';
import {
  type UiChatMessage,
  type PersistedProductChat,
} from '@/features/ai-chat/model/chatTypes';

export const MAX_REQUEST_CONTEXT_LENGTH = 100_000;

export function readProductChat(
  key: string | undefined,
): PersistedProductChat | null {
  if (!key) {
    return null;
  }
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!stored || typeof stored !== 'object') {
      return null;
    }
    const value = stored as Record<string, unknown>;
    if (
      value.version !== 1 ||
      !Array.isArray(value.messages) ||
      typeof value.draft !== 'string' ||
      value.draft.length > CHAT_LIMITS.messageLength
    ) {
      return null;
    }
    const messages: UiChatMessage[] = [];
    for (const item of value.messages) {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const message = item as Record<string, unknown>;
      if (
        typeof message.id !== 'string' ||
        !/^(user|assistant)-[1-9]\d*$/.test(message.id) ||
        (message.role !== 'user' && message.role !== 'assistant') ||
        typeof message.content !== 'string' ||
        !message.content.trim() ||
        Array.from(message.content).length > CHAT_LIMITS.messageLength ||
        typeof message.createdAt !== 'number' ||
        !Number.isFinite(message.createdAt) ||
        typeof message.unread !== 'boolean' ||
        (message.requestContent !== undefined &&
          message.requestContent !== null &&
          typeof message.requestContent !== 'string')
      ) {
        return null;
      }
      const { requestContext, ...rest } = message;
      messages.push({
        ...(rest as UiChatMessage),
        // Only a well-formed string is trusted; anything else is dropped so a
        // consumer treats the answer as having no verifiable request context.
        ...(typeof requestContext === 'string' &&
        requestContext.length <= MAX_REQUEST_CONTEXT_LENGTH
          ? { requestContext }
          : {}),
      });
    }
    return { messages, draft: value.draft };
  } catch {
    return null;
  }
}

export function nextMessageId(messages: readonly UiChatMessage[]): number {
  let next = 1;
  for (const message of messages) {
    const id = Number(message.id.split('-')[1]);
    if (Number.isSafeInteger(id)) {
      next = Math.max(next, id + 1);
    }
  }
  return next;
}
