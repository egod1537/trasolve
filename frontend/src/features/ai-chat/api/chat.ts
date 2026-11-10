import {
  API_ROUTES,
  chatRequestSchema,
  chatResponseSchema,
  type ChatRequest,
  type ChatResponse,
} from '@trasolve/shared';
import { throwIfExternalApiDisabled } from '@/shared/api/externalApiDisabled';
import { L } from '@/shared/i18n';
import {
  billingHeaders,
  notifyBillingChanged,
  withBillingMode,
} from '@/shared/api/billingContext';
import { readBillingError } from '@/shared/api/billingErrors';

export async function sendChat(
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const payload = chatRequestSchema.parse(request);
  const timeout = AbortSignal.timeout(130000);
  let response: Response;
  try {
    response = await fetch(withBillingMode(API_ROUTES.chat), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...billingHeaders() },
      body: JSON.stringify(payload),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    notifyBillingChanged();
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
  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    if (signal?.aborted) {
      throw cause;
    }
    if (timeout.aborted) {
      throw new Error(L('errors:chat.error.waitingTimeReplyHasBeenExceeded'));
    }
    if (!(cause instanceof SyntaxError)) {
      throw new Error(L('errors:chat.error.unableConnectChatServerTryAgain'));
    }
    body = null;
  }
  if (!response.ok) {
    throwIfExternalApiDisabled(body);
    throw new Error(
      readBillingError(body) ??
        L('errors:chat.error.answerCouldNotBeRetrievedTry'),
    );
  }
  const parsed = chatResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(L('errors:chat.error.chatResponseFormatIncorrect'));
  }
  return parsed.data;
}
