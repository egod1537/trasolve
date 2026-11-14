import { recordChatUsage } from '../billing/chatUsage.js';
import { z } from 'zod';
import type { ChatWebImage, UpstreamApiErrorDetails } from '@trasolve/shared';
import { OPENWEBUI_OPTIONS } from '../options.js';
import type { ChatResponse } from '@trasolve/shared';
import type { ChatStreamOptions } from './chatProvider.js';
import { readResponsesStream } from './readResponsesStream.js';
import {
  buildOpenWebUIResponseBody,
  extractAssistantText,
  extractWebImages,
  openWebUIResponseSchema,
} from './openWebUIResponse.js';
import {
  loadExternalApiPolicy,
  type ExternalApiPolicy,
} from '../configuration/externalApiPolicy.js';
import {
  assertInstrumentedNetworkAllowed,
  instrumentExternalApiFetch,
  resolveInstrumentedExternalApiMode,
} from '../observability/externalApiUsage/externalApiUsage.js';

export const DEFAULT_OPENWEBUI_BASE_URL = 'https://chat.mangagaki.net';

const MAX_UPSTREAM_ERROR_BODY_BYTES = 32 * 1024;
const MAX_UPSTREAM_ERROR_MESSAGE_LENGTH = 2_000;
const MAX_UPSTREAM_ERROR_IDENTIFIER_LENGTH = 256;

const chatMessageSchema = z.strictObject({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().refine((value) => value.trim().length > 0),
});

const chatInputSchema = z.strictObject({
  model: z.string().trim().min(1),
  messages: z.array(chatMessageSchema).min(1),
  webSearch: z.boolean().optional(),
  maxOutputTokens: z.number().int().min(1).max(4096).optional(),
});

const modelsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1).optional(),
    }),
  ),
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
  webImages?: ChatWebImage[];
  finishReason: string | null;
};

export type OpenWebUIClientErrorKind =
  | 'configuration'
  | 'invalid_request'
  | 'authentication'
  | 'permission_denied'
  | 'not_found'
  | 'conflict'
  | 'request_too_large'
  | 'upstream_rejected'
  | 'upstream_failure'
  | 'rate_limited'
  | 'timeout'
  | 'unavailable'
  | 'malformed_response';

export type OpenWebUIUpstreamError = UpstreamApiErrorDetails & {
  service: 'openwebui';
  status: number;
};

export class OpenWebUIClientError extends Error {
  public constructor(
    public readonly kind: OpenWebUIClientErrorKind,
    message: string,
    public readonly upstream?: OpenWebUIUpstreamError,
  ) {
    super(message);
    this.name = 'OpenWebUIClientError';
  }

  public get upstreamStatus(): number | undefined {
    return this.upstream?.status;
  }
}

export type OpenWebUIClientOptions = {
  apiKey: string;
  baseUrl?: string;
  cloudflareAccessClientId?: string;
  cloudflareAccessClientSecret?: string;
  modelsTimeoutMs?: number;
  chatTimeoutMs?: number;
  externalApiPolicy?: ExternalApiPolicy;
};

export class OpenWebUIClient {
  public constructor(options: OpenWebUIClientOptions) {
    this.externalApiPolicy =
      options.externalApiPolicy ?? loadExternalApiPolicy();
    this.apiKey = options.apiKey.trim();
    this.baseUrl =
      this.externalApiPolicy.mode === 'enabled'
        ? this.normalizeBaseUrl(options.baseUrl ?? DEFAULT_OPENWEBUI_BASE_URL)
        : new URL('http://localhost/');
    this.cloudflareAccessClientId =
      options.cloudflareAccessClientId?.trim() ?? '';
    this.cloudflareAccessClientSecret =
      options.cloudflareAccessClientSecret?.trim() ?? '';
    if (
      Boolean(this.cloudflareAccessClientId) !==
      Boolean(this.cloudflareAccessClientSecret)
    ) {
      throw new OpenWebUIClientError(
        'configuration',
        'Cloudflare Access requires both the client ID and client secret.',
      );
    }
    this.modelsTimeoutMs = this.normalizeTimeout(
      options.modelsTimeoutMs ?? OPENWEBUI_OPTIONS.modelsTimeoutMs,
      'modelsTimeoutMs',
    );
    this.chatTimeoutMs = this.normalizeTimeout(
      options.chatTimeoutMs ?? OPENWEBUI_OPTIONS.chatTimeoutMs,
      'chatTimeoutMs',
    );
  }

  public async listModels(): Promise<OpenWebUIModel[]> {
    if (
      resolveInstrumentedExternalApiMode(
        this.externalApiPolicy,
        'openwebui',
        'list-models',
      ) === 'mock'
    ) {
      return [{ id: 'trasolve-mock-v1', name: 'Trasolve Mock v1' }];
    }
    const rawResponse = await this.requestJson(
      'openai/models',
      { method: 'GET' },
      this.modelsTimeoutMs,
      'list-models',
    );
    const parsed = modelsResponseSchema.safeParse(rawResponse);
    if (!parsed.success) {
      throw this.malformedResponse('model list');
    }

    return parsed.data.data.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
    }));
  }

  public async chat(
    input: OpenWebUIChatInput,
    signal?: AbortSignal,
  ): Promise<OpenWebUIChatResult> {
    const request = chatInputSchema.safeParse(input);
    if (!request.success) {
      throw new OpenWebUIClientError(
        'invalid_request',
        'The OpenWebUI chat request is invalid.',
      );
    }
    if (
      resolveInstrumentedExternalApiMode(
        this.externalApiPolicy,
        'openwebui',
        'chat',
      ) === 'mock'
    ) {
      return {
        model: request.data.model,
        message: {
          role: 'assistant',
          content: 'Trasolve deterministic OpenWebUI mock response.',
        },
        finishReason: 'stop',
      };
    }

    const rawResponse = await this.requestJson(
      'openai/responses',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildOpenWebUIResponseBody(
            request.data.model,
            request.data.messages,
            false,
            request.data.webSearch !== false,
            request.data.maxOutputTokens,
          ),
        ),
      },
      this.chatTimeoutMs,
      'chat',
      signal,
    );
    const parsed = openWebUIResponseSchema.safeParse(rawResponse);
    if (!parsed.success) {
      throw this.malformedResponse('chat');
    }

    const content = extractAssistantText(parsed.data.output);
    const webImages = extractWebImages(parsed.data.output);
    if (!content.trim()) {
      throw this.malformedResponse('chat');
    }

    recordChatUsage(
      parsed.data.model,
      request.data.messages,
      content,
      parsed.data.usage,
    );
    return {
      model: parsed.data.model,
      message: { role: 'assistant', content },
      ...(webImages.length ? { webImages } : {}),
      finishReason:
        parsed.data.status === 'completed'
          ? 'stop'
          : (parsed.data.status ?? null),
    };
  }

  public async stream(
    input: OpenWebUIChatInput,
    options: ChatStreamOptions,
  ): Promise<ChatResponse> {
    const request = chatInputSchema.parse(input);
    if (
      resolveInstrumentedExternalApiMode(
        this.externalApiPolicy,
        'openwebui',
        'chat',
      ) === 'mock'
    ) {
      const result = await this.chat(request, options.signal);
      return { model: result.model, message: result.message };
    }
    return this.requestJson(
      'openai/responses',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(
          buildOpenWebUIResponseBody(
            request.model,
            request.messages,
            true,
            request.webSearch !== false,
            request.maxOutputTokens,
          ),
        ),
      },
      this.chatTimeoutMs,
      'chat',
      options.signal,
      (response) =>
        readResponsesStream(response, request.model, options, request.messages),
    );
  }

  private readonly apiKey: string;
  private readonly baseUrl: URL;
  private readonly cloudflareAccessClientId: string;
  private readonly cloudflareAccessClientSecret: string;
  private readonly modelsTimeoutMs: number;
  private readonly chatTimeoutMs: number;
  private readonly externalApiPolicy: ExternalApiPolicy;

  private async requestJson<T = unknown>(
    endpoint: string,
    init: RequestInit,
    timeoutMs: number,
    operation: 'list-models' | 'chat',
    parentSignal?: AbortSignal,
    decode?: (response: Response) => Promise<T>,
  ): Promise<T> {
    assertInstrumentedNetworkAllowed(
      this.externalApiPolicy,
      'openwebui',
      operation,
    );
    if (!this.apiKey) {
      throw new OpenWebUIClientError(
        'configuration',
        'The OpenWebUI API key is not configured.',
      );
    }

    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = parentSignal
      ? AbortSignal.any([parentSignal, timeout])
      : timeout;
    try {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${this.apiKey}`);
      if (this.cloudflareAccessClientId && this.cloudflareAccessClientSecret) {
        headers.set('CF-Access-Client-Id', this.cloudflareAccessClientId);
        headers.set(
          'CF-Access-Client-Secret',
          this.cloudflareAccessClientSecret,
        );
      }
      const response = await instrumentExternalApiFetch(
        'openwebui',
        operation,
        () =>
          fetch(new URL(endpoint, this.baseUrl), {
            ...init,
            headers,
            signal,
          }),
      );

      if (!response.ok) {
        throw await this.upstreamError(response);
      }

      if (decode) {
        return await decode(response);
      }
      try {
        return (await response.json()) as T;
      } catch {
        if (signal.aborted) {
          throw this.timeoutError();
        }
        throw this.malformedResponse('JSON');
      }
    } catch (cause) {
      parentSignal?.throwIfAborted();
      if (cause instanceof OpenWebUIClientError) {
        throw cause;
      }
      if (signal.aborted) {
        throw this.timeoutError();
      }
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

  private async upstreamError(
    response: Response,
  ): Promise<OpenWebUIClientError> {
    const upstream = await parseOpenWebUIUpstreamError(response);
    const identifier = upstream.code ? ` (${upstream.code})` : '';
    const explanation = upstream.message ? `: ${upstream.message}` : '';
    return new OpenWebUIClientError(
      classifyOpenWebUIError(upstream),
      `The OpenWebUI upstream returned HTTP ${response.status}${identifier}${explanation}`,
      upstream,
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

async function parseOpenWebUIUpstreamError(
  response: Response,
): Promise<OpenWebUIUpstreamError> {
  const body = await readBoundedResponseBody(response);
  const payload = parseErrorPayload(body.text);
  const records = collectErrorRecords(payload);
  const code = findIdentifier(records, ['code', 'error_code', 'errorCode']);
  const type = findIdentifier(records, ['type', 'error_type', 'errorType']);
  const param = findIdentifier(records, ['param', 'parameter']);
  const message = extractErrorMessage(payload);
  const requestId = firstHeader(response.headers, [
    'x-request-id',
    'x-correlation-id',
    'cf-ray',
  ]);
  const retryAfterMs = parseRetryAfterMs(response.headers);

  return {
    service: 'openwebui',
    status: response.status,
    ...(code ? { code } : {}),
    ...(type ? { type } : {}),
    ...(param ? { param } : {}),
    ...(message ? { message } : {}),
    ...(requestId ? { requestId } : {}),
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    ...(body.truncated ? { bodyTruncated: true } : {}),
  };
}

async function readBoundedResponseBody(
  response: Response,
): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) {
    return { text: '', truncated: false };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      const remaining = MAX_UPSTREAM_ERROR_BODY_BYTES - size;
      if (remaining <= 0) {
        truncated = true;
        await reader.cancel().catch(() => {});
        break;
      }
      const chunk = result.value;
      const accepted =
        chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
      chunks.push(accepted);
      size += accepted.byteLength;
      if (accepted.byteLength !== chunk.byteLength) {
        truncated = true;
        await reader.cancel().catch(() => {});
        break;
      }
    }
  } catch {
    truncated = true;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    text: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
    truncated,
  };
}

function parseErrorPayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    if (/^(?:<!doctype\s+html|<html\b)/i.test(trimmed)) {
      return undefined;
    }
    return trimmed;
  }
}

function collectErrorRecords(value: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const visit = (candidate: unknown, depth: number): void => {
    if (!isRecord(candidate) || depth > 3 || records.includes(candidate)) {
      return;
    }
    records.push(candidate);
    for (const key of ['error', 'errors', 'detail', 'cause', 'issues']) {
      visit(candidate[key], depth + 1);
    }
  };
  visit(value, 0);
  return records;
}

function findIdentifier(
  records: readonly Record<string, unknown>[],
  keys: readonly string[],
): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const normalized = normalizeIdentifier(record[key]);
      if (normalized) {
        return normalized;
      }
    }
  }
  return undefined;
}

function extractErrorMessage(value: unknown, depth = 0): string | undefined {
  if (depth > 4 || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return normalizeDiagnosticText(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return normalizeDiagnosticText(String(value));
  }
  if (Array.isArray(value)) {
    const messages = value
      .map((item) => extractErrorMessage(item, depth + 1))
      .filter((item): item is string => Boolean(item));
    return normalizeDiagnosticText(messages.join('; '));
  }
  if (!isRecord(value)) {
    return undefined;
  }

  const location = Array.isArray(value.loc)
    ? value.loc
        .map((part) => normalizeIdentifier(part))
        .filter((part): part is string => Boolean(part))
        .join('.')
    : undefined;
  const directMessage = extractFirstMessage(value, depth, [
    'message',
    'msg',
    'error_description',
    'description',
    'reason',
    'title',
  ]);
  if (directMessage) {
    return normalizeDiagnosticText(
      location ? `${location}: ${directMessage}` : directMessage,
    );
  }

  return extractFirstMessage(value, depth, [
    'error',
    'errors',
    'detail',
    'cause',
    'issues',
  ]);
}

function extractFirstMessage(
  value: Record<string, unknown>,
  depth: number,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const message = extractErrorMessage(value[key], depth + 1);
    if (message) {
      return message;
    }
  }
  return undefined;
}

function normalizeDiagnosticText(value: string): string | undefined {
  const normalized = redactSensitiveText(value).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.slice(0, MAX_UPSTREAM_ERROR_MESSAGE_LENGTH);
}

function normalizeIdentifier(value: unknown): string | undefined {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    return undefined;
  }
  const normalized = redactSensitiveText(String(value)).trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.slice(0, MAX_UPSTREAM_ERROR_IDENTIFIER_LENGTH);
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(
      /((?:api[_ -]?key|token|secret|password|authorization)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[REDACTED]',
    )
    .replace(/(https?:\/\/)[^/\s:@]+:[^@\s/]+@/gi, '$1[REDACTED]@');
}

function firstHeader(
  headers: Headers,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = normalizeIdentifier(headers.get(name));
    if (value) {
      return value;
    }
  }
  return undefined;
}

function parseRetryAfterMs(headers: Headers): number | undefined {
  const explicitMilliseconds = parseNonNegativeNumber(
    headers.get('retry-after-ms'),
  );
  if (explicitMilliseconds !== undefined) {
    return normalizeRetryDelay(explicitMilliseconds);
  }

  const retryAfter = headers.get('retry-after')?.trim();
  const seconds = parseNonNegativeNumber(retryAfter);
  if (seconds !== undefined) {
    return normalizeRetryDelay(seconds * 1_000);
  }
  if (!retryAfter) {
    return undefined;
  }
  const date = Date.parse(retryAfter);
  return Number.isFinite(date)
    ? normalizeRetryDelay(Math.max(0, date - Date.now()))
    : undefined;
}

function normalizeRetryDelay(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(value));
}

function parseNonNegativeNumber(
  value: string | null | undefined,
): number | undefined {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function classifyOpenWebUIError(
  upstream: OpenWebUIUpstreamError,
): OpenWebUIClientErrorKind {
  const diagnostic =
    `${upstream.code ?? ''} ${upstream.type ?? ''} ${upstream.message ?? ''}`
      .trim()
      .toLowerCase();
  if (
    /\bmodel(?:[\s_-]+\w+){0,3}[\s_-]+not[\s_-]+found\b|\bmodel_not_found\b/.test(
      diagnostic,
    )
  ) {
    return 'not_found';
  }
  if (
    /\brate[\s_-]*limit|too many requests|quota exceeded\b/.test(diagnostic)
  ) {
    return 'rate_limited';
  }
  if (/\btime(?:d[\s_-]*out|out)|deadline exceeded\b/.test(diagnostic)) {
    return 'timeout';
  }
  if (/\brequest(?: body)? too large|payload too large\b/.test(diagnostic)) {
    return 'request_too_large';
  }
  if (/\bconflict\b/.test(diagnostic)) {
    return 'conflict';
  }
  if (
    /\binvalid token\b|\bunauthori[sz]ed\b|\bauthentication failed\b|\bapi[\s_-]*key\b.*\b(?:invalid|missing)\b/.test(
      diagnostic,
    )
  ) {
    return 'authentication';
  }
  if (
    /\bpermission denied\b|\bforbidden\b|\baccess prohibited\b|\bnot allowed\b/.test(
      diagnostic,
    )
  ) {
    return 'permission_denied';
  }

  const { status } = upstream;
  if (status === 401) {
    return 'authentication';
  }
  if (status === 403) {
    return 'permission_denied';
  }
  if (status === 404) {
    return 'not_found';
  }
  if (status === 408 || status === 504) {
    return 'timeout';
  }
  if (status === 409) {
    return 'conflict';
  }
  if (status === 413) {
    return 'request_too_large';
  }
  if (status === 429) {
    return 'rate_limited';
  }
  if (status >= 400 && status < 500) {
    return 'invalid_request';
  }
  if (status >= 500) {
    return 'upstream_failure';
  }
  return 'upstream_rejected';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
