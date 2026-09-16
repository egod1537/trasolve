import { randomUUID } from 'node:crypto';
import type { ChatRequest, ChatResponse } from '@trasolve/shared';
import type { ChatProvider } from '../chatProvider.js';
import { OpenWebUIClient, OpenWebUIClientError } from '../openWebUIClient.js';

export class OpenWebUIChatProvider implements ChatProvider {
  public constructor(client: OpenWebUIClient, defaultModel: string) {
    this.client = client;
    this.defaultModel = defaultModel.trim();
  }

  public async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model ?? this.defaultModel;
    const requestId = randomUUID();
    const startedAt = performance.now();
    if (!model) {
      const error = new OpenWebUIClientError(
        'configuration',
        'The OpenWebUI chat model is not configured.',
      );
      this.logRequest({
        requestId,
        requestedModel: model,
        returnedModel: null,
        elapsedMs: Math.round(performance.now() - startedAt),
        result: 'error',
        errorKind: error.kind,
        upstreamStatus: error.upstreamStatus ?? null,
        localAbortSignalTimeout: false,
      });
      throw error;
    }
    try {
      const result = await this.client.chat({
        model,
        messages: request.messages,
      });
      this.logRequest({
        requestId,
        requestedModel: model,
        returnedModel: result.model,
        elapsedMs: Math.round(performance.now() - startedAt),
        result: 'success',
        errorKind: null,
        upstreamStatus: null,
        localAbortSignalTimeout: false,
      });
      return { message: result.message };
    } catch (cause) {
      const error = cause instanceof OpenWebUIClientError ? cause : undefined;
      this.logRequest({
        requestId,
        requestedModel: model,
        returnedModel: null,
        elapsedMs: Math.round(performance.now() - startedAt),
        result: 'error',
        errorKind: error?.kind ?? 'unexpected',
        upstreamStatus: error?.upstreamStatus ?? null,
        localAbortSignalTimeout: error?.kind === 'timeout',
      });
      throw cause;
    }
  }

  private logRequest(fields: {
    requestId: string;
    requestedModel: string;
    returnedModel: string | null;
    elapsedMs: number;
    result: 'success' | 'error';
    errorKind: string | null;
    upstreamStatus: number | null;
    localAbortSignalTimeout: boolean;
  }): void {
    console.info(JSON.stringify({ event: 'openwebui_chat', ...fields }));
  }

  private readonly client: OpenWebUIClient;
  private readonly defaultModel: string;
}
