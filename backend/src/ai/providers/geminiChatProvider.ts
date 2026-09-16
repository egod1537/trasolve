import type { ChatRequest, ChatResponse } from '@trasolve/shared';
import { z } from 'zod';
import type { ChatProvider } from '../chatProvider.js';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1/';
const DEFAULT_TIMEOUT_MS = 120_000;

const geminiResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        role: z.literal('model'),
        parts: z.array(
          z.object({
            text: z.string().optional(),
          }),
        ),
      }),
    }),
  ),
});

export type GeminiChatProviderErrorKind =
  | 'configuration'
  | 'authentication'
  | 'model_not_found'
  | 'rate_limited'
  | 'timeout'
  | 'upstream_rejected'
  | 'unavailable'
  | 'malformed_response'
  | 'empty_response';

export class GeminiChatProviderError extends Error {
  public constructor(
    public readonly kind: GeminiChatProviderErrorKind,
    message: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'GeminiChatProviderError';
  }
}

export type GeminiChatProviderOptions = {
  apiKey: string;
  model: string;
  timeoutMs?: number;
};

export class GeminiChatProvider implements ChatProvider {
  public constructor(options: GeminiChatProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.model = options.model.trim();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (!this.apiKey) {
      throw new GeminiChatProviderError(
        'configuration',
        'The Gemini API key is not configured.',
      );
    }
    if (!this.model || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(this.model)) {
      throw new GeminiChatProviderError(
        'configuration',
        'The Gemini model is not configured or is invalid.',
      );
    }
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new GeminiChatProviderError(
        'configuration',
        'The Gemini timeout must be a positive integer.',
      );
    }
  }

  public async chat(request: ChatRequest): Promise<ChatResponse> {
    const signal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;

    try {
      response = await fetch(
        new URL(
          `models/${encodeURIComponent(this.model)}:generateContent`,
          GEMINI_API_BASE_URL,
        ),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
            'x-goog-api-client': 'trasolve/0.0.0',
          },
          body: JSON.stringify({
            contents: request.messages.map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
          }),
          signal,
        },
      );
    } catch {
      if (signal.aborted) {
        throw new GeminiChatProviderError(
          'timeout',
          'The Gemini request timed out.',
        );
      }
      throw new GeminiChatProviderError(
        'unavailable',
        'The Gemini upstream is unavailable.',
      );
    }

    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw this.upstreamError(response.status);
    }

    let rawResponse: unknown;
    try {
      rawResponse = (await response.json()) as unknown;
    } catch {
      if (signal.aborted) {
        throw new GeminiChatProviderError(
          'timeout',
          'The Gemini request timed out.',
        );
      }
      throw new GeminiChatProviderError(
        'malformed_response',
        'The Gemini response is malformed.',
      );
    }

    const parsed = geminiResponseSchema.safeParse(rawResponse);
    if (!parsed.success || parsed.data.candidates.length === 0) {
      throw new GeminiChatProviderError(
        'malformed_response',
        'The Gemini response is malformed.',
      );
    }

    const content = parsed.data.candidates[0].content.parts
      .flatMap((part) => (part.text === undefined ? [] : [part.text]))
      .join('')
      .trim();
    if (!content) {
      throw new GeminiChatProviderError(
        'empty_response',
        'The Gemini response did not contain text.',
      );
    }

    return { message: { role: 'assistant', content } };
  }

  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  private upstreamError(status: number): GeminiChatProviderError {
    if (status === 401 || status === 403) {
      return new GeminiChatProviderError(
        'authentication',
        'The Gemini upstream rejected authentication.',
        status,
      );
    }
    if (status === 404) {
      return new GeminiChatProviderError(
        'model_not_found',
        'The configured Gemini model was not found.',
        status,
      );
    }
    if (status === 429) {
      return new GeminiChatProviderError(
        'rate_limited',
        'The Gemini upstream rate limit was reached.',
        status,
      );
    }
    return new GeminiChatProviderError(
      'upstream_rejected',
      'The Gemini upstream rejected the request.',
      status,
    );
  }
}
