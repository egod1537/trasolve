import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  openWebUIModelListResponseSchema,
  type ApiErrorResponse,
  type UpstreamApiErrorDetails,
} from '@trasolve/shared';
import {
  OpenWebUIClient,
  OpenWebUIClientError,
  type OpenWebUIClientErrorKind,
} from './openWebUIClient.js';
import { ExternalApiPolicyError } from '../configuration/externalApiPolicy.js';

const OPENWEBUI_MODEL_ERRORS = {
  configuration: { status: 503, code: 'OPENWEBUI_NOT_CONFIGURED' },
  invalid_request: {
    status: 502,
    code: 'OPENWEBUI_MODELS_REQUEST_REJECTED',
  },
  authentication: {
    status: 502,
    code: 'OPENWEBUI_AUTHENTICATION_FAILED',
  },
  permission_denied: { status: 502, code: 'OPENWEBUI_ACCESS_DENIED' },
  not_found: { status: 502, code: 'OPENWEBUI_MODELS_NOT_FOUND' },
  conflict: { status: 502, code: 'OPENWEBUI_CONFLICT' },
  request_too_large: { status: 502, code: 'OPENWEBUI_REQUEST_TOO_LARGE' },
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

const OPENWEBUI_MODEL_ERROR_MESSAGES: Partial<
  Record<OpenWebUIClientErrorKind, string>
> = {
  configuration: '서버의 OpenWebUI 설정을 확인해 주세요.',
  rate_limited:
    'OpenWebUI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  timeout: 'OpenWebUI 모델 조회 시간이 초과됐습니다.',
};

class ModelListError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly service?: string,
    public readonly upstream?: UpstreamApiErrorDetails,
  ) {
    super(message);
    this.name = 'ModelListError';
  }
}

export class OpenWebUIModelHttpService {
  public constructor(client: OpenWebUIClient | null) {
    this.client = client;
  }

  public async handle(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        throw new ModelListError(
          405,
          'METHOD_NOT_ALLOWED',
          'GET 요청을 사용해 주세요.',
        );
      }
      if (!this.client) {
        throw this.notConfigured();
      }
      const result = openWebUIModelListResponseSchema.safeParse({
        models: await this.client.listModels(),
      });
      if (!result.success) {
        throw this.unavailable();
      }
      if (response.destroyed) {
        return;
      }
      response.writeHead(200);
      response.end(JSON.stringify(result.data));
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error = this.toHttpError(cause);
      const body: ApiErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.service ? { service: error.service } : {}),
          ...(error.upstream ? { upstream: error.upstream } : {}),
        },
      };
      this.writeRetryAfterHeader(response, error.upstream);
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private readonly client: OpenWebUIClient | null;

  private toHttpError(cause: unknown): ModelListError {
    if (cause instanceof ModelListError) {
      return cause;
    }
    if (cause instanceof ExternalApiPolicyError) {
      return new ModelListError(503, cause.code, cause.message, cause.service);
    }
    if (!(cause instanceof OpenWebUIClientError)) {
      return this.unavailable();
    }
    const mapping = OPENWEBUI_MODEL_ERRORS[cause.kind];
    return new ModelListError(
      mapping.status,
      mapping.code,
      OPENWEBUI_MODEL_ERROR_MESSAGES[cause.kind] ?? this.unavailable().message,
      'openwebui',
      cause.upstream,
    );
  }

  private notConfigured(): ModelListError {
    return new ModelListError(
      503,
      'OPENWEBUI_NOT_CONFIGURED',
      '서버의 OpenWebUI 설정을 확인해 주세요.',
      'openwebui',
    );
  }

  private unavailable(): ModelListError {
    return new ModelListError(
      502,
      'OPENWEBUI_MODELS_UNAVAILABLE',
      'OpenWebUI 모델 목록을 불러올 수 없습니다.',
      'openwebui',
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
}
