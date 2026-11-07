import {
  API_ROUTES,
  chatRequestSchema,
  chatResponseSchema,
  type ChatRequest,
  type ChatResponse,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';

export async function sendChat(
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const payload = chatRequestSchema.parse(request);
  const timeout = AbortSignal.timeout(130000);
  let response: Response;
  try {
    response = await fetch(API_ROUTES.chat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (cause) {
    if (signal?.aborted) {
      throw cause;
    }
    throw new Error(
      timeout.aborted
        ? L('errors:chat.error.waitingTimeReplyHasBeenExceeded')
        : L('errors:chat.error.unableConnectChatServerTryAgain'),
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(L('errors:chat.error.answerCouldNotBeRetrievedTry'));
  }
  const parsed = chatResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(L('errors:chat.error.chatResponseFormatIncorrect'));
  }
  return parsed.data;
}
