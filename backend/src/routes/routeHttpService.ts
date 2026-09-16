import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  directionsRequestSchema,
  type DirectionsErrorResponse,
} from '@trasolve/shared';
import { RouteError } from './routeError.js';
import type { RouteService } from './routeService.js';

export class RouteHttpService {
  public constructor(private readonly routeService: RouteService) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        throw new RouteError(
          405,
          'METHOD_NOT_ALLOWED',
          'POST 요청을 사용해 주세요.',
        );
      }
      if (
        request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
        'application/json'
      ) {
        throw new RouteError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Content-Type을 application/json으로 지정해 주세요.',
        );
      }
      const parsed = directionsRequestSchema.safeParse(
        await this.readJson(request),
      );
      if (!parsed.success) {
        throw new RouteError(
          400,
          'INVALID_ROUTE_REQUEST',
          '경로 요청을 확인해 주세요: ' +
            parsed.error.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; '),
        );
      }
      const result = await this.routeService.queryRoutes(parsed.data);
      response.writeHead(200);
      response.end(JSON.stringify(result));
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error =
        cause instanceof RouteError
          ? cause
          : new RouteError(
              500,
              'INTERNAL_ERROR',
              '경로 요청을 처리할 수 없습니다.',
            );
      const body: DirectionsErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
        },
      };
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private readonly maxBodyBytes = 16384;

  private readJson(request: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.maxBodyBytes) {
          chunks.length = 0;
          reject(
            new RouteError(
              413,
              'REQUEST_TOO_LARGE',
              '요청 본문은 16KB 이하여야 합니다.',
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
            new RouteError(
              400,
              'INVALID_JSON',
              '올바른 JSON 본문을 보내 주세요.',
            ),
          );
        }
      });
      request.on('error', reject);
    });
  }
}
