import {
  CHAT_LIMITS,
  type ChatRequest,
  type ChatResponse,
} from '@trasolve/shared';
import { z } from 'zod';
import type { ChatProvider } from '../chatProvider.js';
import {
  TRIP_COMMAND_PLAN_TOOL_NAME,
  createTripCommandPlanFunctionDeclaration,
  parseTripCommandPlanToolCall,
} from '../tools/tripCommandPlanTool.js';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1/';
// Function calling is sent to v1beta; plain text requests stay on v1.
const GEMINI_TOOLS_API_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/';
const DEFAULT_TIMEOUT_MS = 120_000;

const geminiResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        role: z.literal('model'),
        parts: z.array(
          z.object({
            text: z.string().optional(),
            functionCall: z
              .object({ name: z.string(), args: z.unknown().optional() })
              .optional(),
          }),
        ),
      }),
    }),
  ),
});

const GEMINI_HOST = 'generativelanguage.googleapis.com';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * The API key is sent to the base URL, so an override is accepted only for the
 * Google https host or a loopback stub. The parsed hostname is compared exactly.
 */
export function isAllowedGeminiBaseUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || url.search || url.hash) {
    return false;
  }
  if (!url.pathname.endsWith('/')) {
    return false;
  }
  if (url.protocol === 'https:' && url.hostname === GEMINI_HOST) {
    return true;
  }
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    LOOPBACK_HOSTS.has(url.hostname)
  );
}

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
  nativeTools?: boolean;
  baseUrl?: string;
};

export class GeminiChatProvider implements ChatProvider {
  public constructor(options: GeminiChatProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.model = options.model.trim();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.nativeTools = options.nativeTools ?? false;
    this.baseUrlOverride = options.baseUrl?.trim() || undefined;

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
    if (
      this.baseUrlOverride !== undefined &&
      !isAllowedGeminiBaseUrl(this.baseUrlOverride)
    ) {
      throw new GeminiChatProviderError(
        'configuration',
        'The Gemini base URL must be the Google https URL or a loopback URL ending with a slash.',
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
    const useTools =
      this.nativeTools &&
      request.tools?.includes(TRIP_COMMAND_PLAN_TOOL_NAME) === true;
    const systemInstruction = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));
    let response: Response;

    try {
      response = await fetch(
        new URL(
          `models/${encodeURIComponent(this.model)}:generateContent`,
          this.baseUrlOverride ??
            (useTools ? GEMINI_TOOLS_API_BASE_URL : GEMINI_API_BASE_URL),
        ),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
            'x-goog-api-client': 'trasolve/0.0.0',
          },
          body: JSON.stringify({
            ...(systemInstruction
              ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
              : {}),
            contents,
            ...(useTools
              ? {
                  tools: [
                    {
                      functionDeclarations: [
                        createTripCommandPlanFunctionDeclaration(),
                      ],
                    },
                  ],
                  toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
                }
              : {}),
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

    const parts = parsed.data.candidates[0].content.parts;
    const calls = parts.flatMap((part) =>
      part.functionCall === undefined ? [] : [part.functionCall],
    );
    if (calls.length > 0) {
      // A function call is only accepted when it was requested, is the single
      // call, and its arguments are a valid Plan. Anything else is refused.
      const plan =
        useTools && calls.length === 1
          ? parseTripCommandPlanToolCall(calls[0])
          : null;
      const planText = plan === null ? '' : JSON.stringify(plan);
      if (plan === null || planText.length > CHAT_LIMITS.messageLength) {
        throw new GeminiChatProviderError(
          'malformed_response',
          'The Gemini tool call was not accepted.',
        );
      }
      return {
        message: { role: 'assistant', content: planText },
        toolCall: { name: TRIP_COMMAND_PLAN_TOOL_NAME, arguments: plan },
      };
    }

    const content = parts
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
  private readonly nativeTools: boolean;
  private readonly baseUrlOverride: string | undefined;

  private upstreamError(status: number): GeminiChatProviderError {
    // Status only: never the request, the response body or the key.
    console.warn(JSON.stringify({ event: 'gemini_upstream_error', status }));
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
