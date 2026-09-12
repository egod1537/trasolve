import { z } from 'zod';

export const DEFAULT_OPENWEBUI_BASE_URL = 'https://chat.mangagaki.net';

const DEFAULT_MODELS_TIMEOUT_MS = 15_000;
const DEFAULT_CHAT_TIMEOUT_MS = 120_000;

const chatMessageSchema = z.strictObject({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().refine((value) => value.trim().length > 0),
});

const chatInputSchema = z.strictObject({
  model: z.string().trim().min(1),
  messages: z.array(chatMessageSchema).min(1),
});

const modelsResponseSchema = z.object({
  models: z.array(
    z
      .object({
        model: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).optional(),
      })
      .refine((model) => model.model !== undefined || model.name !== undefined),
  ),
});

const chatResponseSchema = z.object({
  model: z.string().trim().min(1),
  message: z.object({
    role: z.literal('assistant'),
    content: z.string(),
  }),
  done: z.literal(true),
  done_reason: z.string().nullable().optional(),
});

export type OpenWebUIModel = {
  id: string;
  name: string;
};

export type OpenWebUIChatMessage = z.infer<typeof chatMessageSchema>;
export type OpenWebUIChatInput = z.infer<typeof chatInputSchema>;

export type OpenWebUIChatResult = {
  model: string;
  message: {
    role: 'assistant';
    content: string;
  };
  finishReason: string | null;
};

export type OpenWebUIClientErrorKind =
  | 'configuration'
  | 'invalid_request'
  | 'authentication'
  | 'upstream_rejected'
  | 'rate_limited'
  | 'timeout'
  | 'unavailable'
  | 'malformed_response';

export class OpenWebUIClientError extends Error {
  public constructor(
    public readonly kind: OpenWebUIClientErrorKind,
    message: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'OpenWebUIClientError';
  }
}

export type OpenWebUIClientOptions = {
  apiKey: string;
  baseUrl?: string;
  modelsTimeoutMs?: number;
  chatTimeoutMs?: number;
};

export class OpenWebUIClient {
  public constructor(options: OpenWebUIClientOptions) {
    this.apiKey = options.apiKey.trim();
    this.baseUrl = this.normalizeBaseUrl(
      options.baseUrl ?? DEFAULT_OPENWEBUI_BASE_URL,
    );
    this.modelsTimeoutMs = this.normalizeTimeout(
      options.modelsTimeoutMs ?? DEFAULT_MODELS_TIMEOUT_MS,
      'modelsTimeoutMs',
    );
    this.chatTimeoutMs = this.normalizeTimeout(
      options.chatTimeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS,
      'chatTimeoutMs',
    );
  }

  public async listModels(): Promise<OpenWebUIModel[]> {
    const rawResponse = await this.requestJson(
      'ollama/api/tags',
      { method: 'GET' },
      this.modelsTimeoutMs,
    );
    const parsed = modelsResponseSchema.safeParse(rawResponse);
    if (!parsed.success) throw this.malformedResponse('model list');

    return parsed.data.models.map((model) => {
      const id = model.model ?? model.name!;
      return { id, name: model.name ?? id };
    });
  }

  public async chat(input: OpenWebUIChatInput): Promise<OpenWebUIChatResult> {
    const request = chatInputSchema.safeParse(input);
    if (!request.success) {
      throw new OpenWebUIClientError(
        'invalid_request',
        'The OpenWebUI chat request is invalid.',
      );
    }

    const rawResponse = await this.requestJson(
      'ollama/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request.data, stream: false }),
      },
      this.chatTimeoutMs,
    );
    const parsed = chatResponseSchema.safeParse(rawResponse);
    if (!parsed.success) throw this.malformedResponse('chat');

    return {
      model: parsed.data.model,
      message: parsed.data.message,
      finishReason: parsed.data.done_reason ?? null,
    };
  }

  private readonly apiKey: string;
  private readonly baseUrl: URL;
  private readonly modelsTimeoutMs: number;
  private readonly chatTimeoutMs: number;

  private async requestJson(
    endpoint: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new OpenWebUIClientError(
        'configuration',
        'The OpenWebUI API key is not configured.',
      );
    }

    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${this.apiKey}`);
      const response = await fetch(new URL(endpoint, this.baseUrl), {
        ...init,
        headers,
        signal,
      });

      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw this.upstreamError(response.status);
      }

      try {
        return (await response.json()) as unknown;
      } catch {
        if (signal.aborted) throw this.timeoutError();
        throw this.malformedResponse('JSON');
      }
    } catch (cause) {
      if (cause instanceof OpenWebUIClientError) throw cause;
      if (signal.aborted) throw this.timeoutError();
      throw new OpenWebUIClientError(
        'unavailable',
        'The OpenWebUI upstream is unavailable.',
      );
    }
  }

  private normalizeBaseUrl(value: string): URL {
    try {
      const url = new URL(value.trim());
      if (
        (url.protocol !== 'https:' && url.protocol !== 'http:') ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error('Unsupported OpenWebUI base URL.');
      }
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
      return url;
    } catch {
      throw new OpenWebUIClientError(
        'configuration',
        'The OpenWebUI base URL is invalid.',
      );
    }
  }

  private normalizeTimeout(value: number, option: string): number {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new OpenWebUIClientError(
        'configuration',
        `The OpenWebUI ${option} option must be a positive integer.`,
      );
    }
    return value;
  }

  private upstreamError(status: number): OpenWebUIClientError {
    if (status === 401 || status === 403) {
      return new OpenWebUIClientError(
        'authentication',
        'The OpenWebUI upstream rejected authentication.',
        status,
      );
    }
    if (status === 429) {
      return new OpenWebUIClientError(
        'rate_limited',
        'The OpenWebUI upstream rate limit was reached.',
        status,
      );
    }
    return new OpenWebUIClientError(
      'upstream_rejected',
      'The OpenWebUI upstream rejected the request.',
      status,
    );
  }

  private timeoutError(): OpenWebUIClientError {
    return new OpenWebUIClientError(
      'timeout',
      'The OpenWebUI request timed out.',
    );
  }

  private malformedResponse(response: string): OpenWebUIClientError {
    return new OpenWebUIClientError(
      'malformed_response',
      `The OpenWebUI ${response} response is malformed.`,
    );
  }
}
