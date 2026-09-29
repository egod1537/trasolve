import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ANALYTICS_EVENT_BODY_LIMIT,
  analyticsEventRequestSchema,
  analyticsEventSchema,
  type ApiErrorResponse,
} from '@trasolve/shared';
import type { CurrentUserResolver } from '../auth/currentUserResolver.js';
import type { AnalyticsRepository } from './analyticsEventRepository.js';

export class AnalyticsEventHttpService {
  public constructor(
    private readonly repository: AnalyticsRepository,
    private readonly currentUser: CurrentUserResolver,
  ) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        throw new AnalyticsHttpError(
          405,
          'METHOD_NOT_ALLOWED',
          'Method not allowed.',
        );
      }

      const input = await this.readInput(request);
      const userId = (await this.currentUser.resolve(request)) ?? null;
      const parsedEvent = analyticsEventSchema.safeParse({
        ...input,
        id: randomUUID(),
        userId,
        target: input.target ?? null,
        metadata: input.metadata ?? null,
      });
      if (!parsedEvent.success) {
        throw this.invalidRequest();
      }
      await this.repository.append(parsedEvent.data);

      if (!response.destroyed) {
        response.removeHeader('Content-Type');
        response.writeHead(204);
        response.end();
      }
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error =
        cause instanceof AnalyticsHttpError
          ? cause
          : new AnalyticsHttpError(
              503,
              'ANALYTICS_STORAGE_UNAVAILABLE',
              'Analytics storage is unavailable.',
            );
      const body: ApiErrorResponse = {
        error: { code: error.code, message: error.message },
      };
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private async readInput(request: IncomingMessage) {
    if (
      request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
      'application/json'
    ) {
      throw new AnalyticsHttpError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Content-Type must be application/json.',
      );
    }

    const contentLength = request.headers['content-length'];
    if (
      contentLength !== undefined &&
      (!/^\d+$/.test(contentLength) ||
        Number(contentLength) > ANALYTICS_EVENT_BODY_LIMIT)
    ) {
      request.resume();
      throw this.requestTooLarge();
    }

    const body = await new Promise<unknown>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > ANALYTICS_EVENT_BODY_LIMIT) {
          chunks.length = 0;
          reject(this.requestTooLarge());
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > ANALYTICS_EVENT_BODY_LIMIT) {
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(this.invalidRequest());
        }
      });
      request.on('error', reject);
      request.on('aborted', () => reject(this.invalidRequest()));
    });
    const parsed = analyticsEventRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw this.invalidRequest();
    }
    return parsed.data;
  }

  private invalidRequest(): AnalyticsHttpError {
    return new AnalyticsHttpError(
      400,
      'INVALID_ANALYTICS_EVENT',
      'Analytics event request is invalid.',
    );
  }

  private requestTooLarge(): AnalyticsHttpError {
    return new AnalyticsHttpError(
      413,
      'REQUEST_TOO_LARGE',
      'Analytics event request is too large.',
    );
  }
}

class AnalyticsHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AnalyticsHttpError';
  }
}
