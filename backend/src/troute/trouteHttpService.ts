import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  trouteOptimizeRequestSchema,
  type ApiErrorResponse,
} from '@trasolve/shared';
import { TrouteClientError, TrouteHttpError } from './errors.js';
import {
  TrouteJobRepository,
  TrouteJobRepositoryError,
} from '../internal/troute/trouteJobRepository.js';
import type { TrouteClient } from './trouteClient.js';

type TrouteApiErrorResponse = ApiErrorResponse & {
  error: ApiErrorResponse['error'] & { upstreamStatus?: number };
};

export class TrouteHttpService {
  public constructor(
    private readonly client: TrouteClient | null,
    private readonly jobs: TrouteJobRepository,
  ) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        throw new TrouteHttpError(
          405,
          'METHOD_NOT_ALLOWED',
          'POST 요청을 사용해 주세요.',
        );
      }
      if (
        request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
        'application/json'
      ) {
        throw new TrouteHttpError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Content-Type을 application/json으로 지정해 주세요.',
        );
      }
      if (!this.client) {
        throw this.notConfiguredError();
      }

      const parsed = trouteOptimizeRequestSchema.safeParse(
        await this.readJson(request),
      );
      if (!parsed.success) {
        throw new TrouteHttpError(
          400,
          'INVALID_TROUTE_REQUEST',
          'troute 최적화 요청의 형식과 값을 확인해 주세요.',
        );
      }

      this.jobs.create(parsed.data.job_id);
      const result = await this.client.optimize(parsed.data);
      this.jobs.recordSynchronousResult(parsed.data.job_id, result);
      if (response.destroyed) {
        return;
      }
      response.writeHead(200);
      response.end(JSON.stringify(result));
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error = this.toHttpError(cause);
      const body: TrouteApiErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.upstreamStatus === undefined
            ? {}
            : { upstreamStatus: error.upstreamStatus }),
        },
      };
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private readonly maxBodyBytes = 1_048_576;

  private readJson(request: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.maxBodyBytes) {
          chunks.length = 0;
          reject(
            new TrouteHttpError(
              413,
              'REQUEST_TOO_LARGE',
              '요청 본문은 1MiB 이하여야 합니다.',
            ),
          );
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > this.maxBodyBytes) {
          return;
        }
        try {
          resolve(
            JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
          );
        } catch {
          reject(
            new TrouteHttpError(
              400,
              'INVALID_JSON',
              '올바른 JSON 본문을 보내 주세요.',
            ),
          );
        }
      });
      request.on('error', reject);
      request.on('aborted', () =>
        reject(
          new TrouteHttpError(
            400,
            'INVALID_TROUTE_REQUEST',
            'troute 최적화 요청을 읽을 수 없습니다.',
          ),
        ),
      );
    });
  }

  private toHttpError(cause: unknown): TrouteHttpError {
    if (cause instanceof TrouteHttpError) {
      return cause;
    }
    if (cause instanceof TrouteJobRepositoryError) {
      return cause.kind === 'job_already_exists'
        ? new TrouteHttpError(
            409,
            'TROUTE_JOB_ALREADY_EXISTS',
            '같은 ID의 troute job이 이미 존재합니다.',
          )
        : new TrouteHttpError(
            400,
            'INVALID_TROUTE_REQUEST',
            'troute 최적화 요청의 job_id를 확인해 주세요.',
          );
    }
    if (!(cause instanceof TrouteClientError)) {
      return new TrouteHttpError(
        500,
        'INTERNAL_ERROR',
        'troute 최적화 요청을 처리할 수 없습니다.',
      );
    }

    switch (cause.kind) {
      case 'configuration':
        return this.notConfiguredError();
      case 'invalid_request':
        return new TrouteHttpError(
          400,
          'INVALID_TROUTE_REQUEST',
          'troute 최적화 요청의 형식과 값을 확인해 주세요.',
        );
      case 'timeout':
        return new TrouteHttpError(
          504,
          'TROUTE_TIMEOUT',
          'troute 최적화 요청 시간이 초과됐습니다.',
        );
      case 'connection_failure':
        return new TrouteHttpError(
          503,
          'TROUTE_UNAVAILABLE',
          'troute 서버에 연결할 수 없습니다.',
        );
      case 'invalid_response':
        return new TrouteHttpError(
          502,
          'INVALID_TROUTE_RESPONSE',
          'troute 서버의 응답 형식이 올바르지 않습니다.',
        );
      case 'upstream_http': {
        const upstreamStatus = cause.upstreamStatus;
        const status =
          upstreamStatus !== undefined &&
          upstreamStatus >= 400 &&
          upstreamStatus < 500
            ? upstreamStatus
            : 502;
        return new TrouteHttpError(
          status,
          'TROUTE_UPSTREAM_ERROR',
          'troute 서버가 최적화 요청을 처리하지 못했습니다.',
          upstreamStatus,
        );
      }
    }
  }

  private notConfiguredError(): TrouteHttpError {
    return new TrouteHttpError(
      503,
      'TROUTE_NOT_CONFIGURED',
      '서버의 TROUTE_BASE_URL 설정을 확인해 주세요.',
    );
  }
}
