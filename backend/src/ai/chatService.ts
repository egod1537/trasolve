import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  CHAT_LIMITS,
  chatRequestSchema,
  chatResponseSchema,
  type ApiErrorResponse,
  type ChatRequest,
  type ChatResponse,
  type UpstreamApiErrorDetails,
} from '@trasolve/shared';
import type { ChatProvider } from './chatProvider.js';
import type { TokenMeter } from '../billing/billingHttpService.js';
import { BillingError } from '../billing/paymentProvider.js';
import {
  OpenWebUIClientError,
  type OpenWebUIClientErrorKind,
} from './openWebUIClient.js';
import { ExternalApiPolicyError } from '../configuration/externalApiPolicy.js';
import { runChatStream, writeChatStreamEvent } from './chatStream.js';

const OPENWEBUI_CHAT_ERRORS = {
  configuration: { status: 503, code: 'OPENWEBUI_NOT_CONFIGURED' },
  invalid_request: { status: 400, code: 'OPENWEBUI_INVALID_REQUEST' },
  authentication: {
    status: 502,
    code: 'OPENWEBUI_AUTHENTICATION_FAILED',
  },
  permission_denied: { status: 502, code: 'OPENWEBUI_ACCESS_DENIED' },
  not_found: { status: 502, code: 'OPENWEBUI_MODEL_NOT_FOUND' },
  conflict: { status: 409, code: 'OPENWEBUI_CONFLICT' },
  request_too_large: { status: 413, code: 'OPENWEBUI_REQUEST_TOO_LARGE' },
  upstream_rejected: { status: 502, code: 'OPENWEBUI_REQUEST_REJECTED' },
  upstream_failure: { status: 502, code: 'OPENWEBUI_UPSTREAM_FAILURE' },
  rate_limited: { status: 429, code: 'OPENWEBUI_RATE_LIMITED' },
  timeout: { status: 504, code: 'OPENWEBUI_TIMEOUT' },
  unavailable: { status: 503, code: 'OPENWEBUI_UNAVAILABLE' },
  malformed_response: { status: 502, code: 'OPENWEBUI_INVALID_RESPONSE' },
} as const satisfies Record<
  OpenWebUIClientErrorKind,
  { status: number; code: string }
>;

class ChatError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly service?: string,
    public readonly upstream?: UpstreamApiErrorDetails,
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

export class ChatService {
  public constructor(private readonly provider: ChatProvider) {}

  public setTokenMeter(meter: TokenMeter): void {
    this.tokenMeter = meter;
  }

  public async chat(
    request: ChatRequest,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    const parsed = chatRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw this.invalidRequest();
    }
    try {
      const result = chatResponseSchema.safeParse(
        await this.provider.chat(parsed.data, signal),
      );
      if (!result.success) {
        throw this.unavailable();
      }
      return result.data;
    } catch (cause) {
      if (cause instanceof ExternalApiPolicyError) {
        throw new ChatError(503, cause.code, cause.message, cause.service);
      }
      if (cause instanceof OpenWebUIClientError) {
        throw this.openWebUIError(cause);
      }
      // Provider errors and raw responses must not reach the client.
      throw this.unavailable();
    }
  }

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    stream = false,
  ) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        throw new ChatError(
          405,
          'METHOD_NOT_ALLOWED',
          'POST 요청을 사용해 주세요.',
        );
      }
      if (
        request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
        'application/json'
      ) {
        throw new ChatError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Content-Type을 application/json으로 지정해 주세요.',
        );
      }
      const parsed = chatRequestSchema.safeParse(await this.readJson(request));
      if (!parsed.success) {
        throw this.invalidRequest();
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      response.once('close', abort);
      const execute = () =>
        stream
          ? runChatStream(this.provider, parsed.data, {
              signal: controller.signal,
              onEvent: (event) => writeChatStreamEvent(response, event),
            })
          : this.chat(parsed.data, controller.signal);
      const heartbeat = stream
        ? setInterval(() => {
            if (
              response.headersSent &&
              !response.destroyed &&
              !response.writableEnded
            ) {
              response.write(': keepalive\n\n');
            }
          }, 15000)
        : undefined;
      heartbeat?.unref();
      try {
        const result = this.tokenMeter
          ? await this.tokenMeter.run(request, 'chat', execute)
          : await execute();
        if (response.destroyed) {
          return;
        }
        if (stream) {
          // Completion is published only after the wallet settlement succeeds.
          writeChatStreamEvent(response, { type: 'complete', result });
          response.end();
        } else {
          response.writeHead(200);
          response.end(JSON.stringify(result));
        }
      } finally {
        clearInterval(heartbeat);
        response.removeListener('close', abort);
      }
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error =
        cause instanceof BillingError
          ? new ChatError(cause.status, cause.code, cause.code)
          : cause instanceof ExternalApiPolicyError
            ? new ChatError(503, cause.code, cause.message, cause.service)
            : cause instanceof OpenWebUIClientError
              ? this.openWebUIError(cause)
              : cause instanceof ChatError
                ? cause
                : this.unavailable();
      const body: ApiErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.service ? { service: error.service } : {}),
          ...(error.upstream ? { upstream: error.upstream } : {}),
        },
      };
      if (response.headersSent) {
        writeChatStreamEvent(response, {
          type: 'error',
          code: error.code,
          message: error.message,
        });
        response.end();
        return;
      }
      this.writeRetryAfterHeader(response, error.upstream);
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private tokenMeter?: TokenMeter;
  private invalidRequest() {
    return new ChatError(
      400,
      'INVALID_CHAT_REQUEST',
      '대화 메시지의 역할, 내용 또는 길이를 확인해 주세요.',
    );
  }

  private unavailable() {
    return new ChatError(
      502,
      'CHAT_UNAVAILABLE',
      '답변을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  private openWebUIError(cause: OpenWebUIClientError): ChatError {
    const mapping = OPENWEBUI_CHAT_ERRORS[cause.kind];
    return new ChatError(
      mapping.status,
      mapping.code,
      this.unavailable().message,
      'openwebui',
      cause.upstream,
    );
  }

  private writeRetryAfterHeader(
    response: ServerResponse,
    upstream: UpstreamApiErrorDetails | undefined,
  ): void {
    if (upstream?.retryAfterMs === undefined) {
      return;
    }
    response.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil(upstream.retryAfterMs / 1_000))),
    );
  }

  private readJson(request: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > CHAT_LIMITS.bodyBytes) {
          chunks.length = 0;
          reject(
            new ChatError(
              413,
              'REQUEST_TOO_LARGE',
              '요청 본문은 2MiB 이하여야 합니다.',
            ),
          );
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > CHAT_LIMITS.bodyBytes) {
          return;
        }
        try {
          resolve(
            JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
          );
        } catch {
          reject(this.invalidRequest());
        }
      });
      request.on('error', reject);
      request.on('aborted', () => reject(this.invalidRequest()));
    });
  }
}
