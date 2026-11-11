import type { IncomingMessage, ServerResponse } from 'node:http';
import { TUTORIAL_VERSION, tutorialProgressSchema } from '@trasolve/shared';
import { z } from 'zod';
import type { AuthRepository } from './authRepository.js';
import {
  AuthenticationRequiredError,
  type CurrentUserResolver,
} from './currentUserResolver.js';

export class TutorialHttpService {
  public constructor(
    private readonly repository: AuthRepository,
    private readonly currentUser: CurrentUserResolver,
  ) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== 'GET' && request.method !== 'PUT') {
        response.setHeader('Allow', 'GET, PUT');
        this.send(response, 405, { error: { code: 'METHOD_NOT_ALLOWED' } });
        return;
      }
      const userId = await this.currentUser.require(request);
      if (request.headers['x-trasolve-tutorial-user'] !== userId) {
        this.send(response, 403, { error: { code: 'ACCOUNT_CHANGED' } });
        return;
      }
      if (request.method === 'PUT') {
        // A custom header and JSON-only body prevent cross-origin form writes.
        if (
          request.headers['x-trasolve-tutorial'] !== '1' ||
          request.headers['sec-fetch-site'] === 'cross-site'
        ) {
          this.send(response, 403, { error: { code: 'FORBIDDEN' } });
          return;
        }
        if (
          request.headers['content-type']?.split(';')[0].trim() !==
          'application/json'
        ) {
          this.send(response, 415, {
            error: { code: 'UNSUPPORTED_MEDIA_TYPE' },
          });
          return;
        }
        const progress = tutorialProgressSchema.parse(await readJson(request));
        if (progress.version !== TUTORIAL_VERSION) {
          this.send(response, 400, {
            error: { code: 'INVALID_TUTORIAL_VERSION' },
          });
          return;
        }
        await this.repository.saveTutorialProgress(userId, progress);
        this.send(response, 200, progress);
      } else {
        this.send(
          response,
          200,
          await this.repository.getTutorialProgress(userId),
        );
      }
    } catch (cause) {
      const status =
        cause instanceof AuthenticationRequiredError
          ? 401
          : cause instanceof z.ZodError ||
              cause instanceof SyntaxError ||
              cause instanceof RangeError
            ? 400
            : 503;
      this.send(response, status, {
        error: {
          code:
            status === 401
              ? 'AUTHENTICATION_REQUIRED'
              : status === 400
                ? 'INVALID_TUTORIAL_PROGRESS'
                : 'STORAGE_UNAVAILABLE',
        },
      });
    }
  }

  private send(response: ServerResponse, status: number, body: unknown): void {
    if (response.destroyed) {
      return;
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.writeHead(status);
    response.end(JSON.stringify(body));
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 4096) {
      throw new RangeError('Tutorial progress body is too large.');
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
