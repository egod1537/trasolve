import {
  API_ROUTES,
  chatRequestSchema,
  chatStreamEventSchema,
  readSseData,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamEvent,
} from '@trasolve/shared';
import {
  billingHeaders,
  notifyBillingChanged,
  withBillingMode,
} from '@/shared/api/billingContext';
import { readBillingError } from '@/shared/api/billingErrors';
import { throwIfExternalApiDisabled } from '@/shared/api/externalApiDisabled';
import { L } from '@/shared/i18n';

export async function streamChat(
  request: ChatRequest,
  signal: AbortSignal,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<ChatResponse> {
  const timeout = AbortSignal.timeout(145000);
  try {
    const response = await fetch(withBillingMode(API_ROUTES.chatStream), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...billingHeaders(),
      },
      body: JSON.stringify(chatRequestSchema.parse(request)),
      signal: AbortSignal.any([signal, timeout]),
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throwIfExternalApiDisabled(body);
      throw new Error(
        readBillingError(body) ??
          L('errors:chat.error.answerCouldNotBeRetrievedTry'),
      );
    }
    if (
      !response.body ||
      !response.headers.get('content-type')?.startsWith('text/event-stream')
    ) {
      throw new Error(L('errors:chat.error.chatResponseFormatIncorrect'));
    }
    for await (const data of readSseData(response.body, new TextDecoder())) {
      signal.throwIfAborted();
      const event = chatStreamEventSchema.parse(JSON.parse(data));
      if (event.type === 'error') {
        throw new Error(
          readBillingError({ error: event }) ??
            L('errors:chat.error.answerCouldNotBeRetrievedTry'),
        );
      }
      onEvent(event);
      if (event.type === 'complete') {
        return event.result;
      }
    }
    throw new Error(L('errors:chat.error.chatResponseFormatIncorrect'));
  } catch (cause) {
    if (signal.aborted) {
      throw cause;
    }
    if (timeout.aborted) {
      throw new Error(L('errors:chat.error.waitingTimeReplyHasBeenExceeded'));
    }
    if (
      cause instanceof SyntaxError ||
      (cause instanceof Error && cause.name === 'ZodError')
    ) {
      throw new Error(L('errors:chat.error.chatResponseFormatIncorrect'));
    }
    if (cause instanceof TypeError) {
      throw new Error(L('errors:chat.error.unableConnectChatServerTryAgain'));
    }
    throw cause;
  } finally {
    notifyBillingChanged();
  }
}
