import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  openWebUIModelListResponseSchema,
  type ApiErrorResponse,
} from '@trasolve/shared';
import { OpenWebUIClient, OpenWebUIClientError } from './openWebUIClient.js';

class ModelListError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
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
        error: { code: error.code, message: error.message },
      };
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private readonly client: OpenWebUIClient | null;

  private toHttpError(cause: unknown): ModelListError {
    if (cause instanceof ModelListError) {
      return cause;
    }
    if (!(cause instanceof OpenWebUIClientError)) {
      return this.unavailable();
    }
    switch (cause.kind) {
      case 'configuration':
        return this.notConfigured();
      case 'rate_limited':
        return new ModelListError(
          503,
          'OPENWEBUI_RATE_LIMITED',
          'OpenWebUI 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
        );
      case 'timeout':
        return new ModelListError(
          504,
          'OPENWEBUI_TIMEOUT',
          'OpenWebUI 모델 조회 시간이 초과됐습니다.',
        );
      default:
        return this.unavailable();
    }
  }

  private notConfigured(): ModelListError {
    return new ModelListError(
      503,
      'OPENWEBUI_NOT_CONFIGURED',
      '서버의 OpenWebUI 설정을 확인해 주세요.',
    );
  }

  private unavailable(): ModelListError {
    return new ModelListError(
      502,
      'OPENWEBUI_MODELS_UNAVAILABLE',
      'OpenWebUI 모델 목록을 불러올 수 없습니다.',
    );
  }
}
