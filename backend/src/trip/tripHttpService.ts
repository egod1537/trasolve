import type { IncomingMessage, ServerResponse } from 'node:http';
import { TRIP_BODY_LIMIT, tripInputSchema } from '@trasolve/shared';
import {
  AuthenticationRequiredError,
  type CurrentUserResolver,
} from '../auth/currentUserResolver.js';
import type { TripController } from './tripController.js';
import {
  TripError,
  invalidTripRequest,
  tripAuthenticationRequired,
  tripPreconditionRequired,
  tripStorageUnavailable,
} from './errors.js';

const revisionPattern = /^[1-9]\d*$/;

export class TripHttpService {
  public constructor(
    private readonly controller: TripController,
    private readonly currentUser: CurrentUserResolver,
  ) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    encodedTripId?: string,
  ): Promise<void> {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    try {
      const allowed =
        encodedTripId === undefined
          ? ['GET', 'POST']
          : ['GET', 'PUT', 'DELETE'];
      if (!allowed.includes(request.method ?? '')) {
        response.setHeader('Allow', allowed.join(', '));
        throw new TripError(
          405,
          'METHOD_NOT_ALLOWED',
          '지원하지 않는 요청 방식입니다.',
        );
      }
      const actorUserId = await this.currentUser.require(request);
      let tripId: string | undefined;
      try {
        tripId =
          encodedTripId === undefined
            ? undefined
            : decodeURIComponent(encodedTripId);
      } catch {
        throw invalidTripRequest();
      }
      let body: unknown;
      let revision: string | undefined;
      let status = 200;
      switch (request.method) {
        case 'GET':
          if (tripId === undefined) {
            body = await this.controller.listTrips(actorUserId);
          } else {
            const stored = await this.controller.getTrip(actorUserId, tripId);
            body = stored.trip;
            revision = stored.revision;
          }
          break;
        case 'POST': {
          const stored = await this.controller.createTrip(
            actorUserId,
            await this.readInput(request),
          );
          body = stored.trip;
          revision = stored.revision;
          status = 201;
          break;
        }
        case 'PUT': {
          const stored = await this.controller.saveTrip(
            actorUserId,
            tripId!,
            this.parseIfMatch(request),
            await this.readInput(request),
          );
          body = stored.trip;
          revision = stored.revision;
          break;
        }
        case 'DELETE':
          revision = await this.controller.deleteTrip(
            actorUserId,
            tripId!,
            this.parseIfMatch(request),
          );
          status = 204;
          break;
      }
      if (response.destroyed) {
        return;
      }
      if (revision) {
        response.setHeader('ETag', this.formatEtag(revision));
      }
      response.writeHead(status);
      response.end(status === 204 ? undefined : JSON.stringify(body));
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error =
        cause instanceof TripError
          ? cause
          : cause instanceof AuthenticationRequiredError
            ? tripAuthenticationRequired()
            : tripStorageUnavailable();
      response.writeHead(error.status);
      response.end(
        JSON.stringify({ error: { code: error.code, message: error.message } }),
      );
    }
  }

  private parseIfMatch(request: IncomingMessage): string {
    const header = request.headers['if-match'];
    if (header === undefined) {
      throw tripPreconditionRequired();
    }
    if (Array.isArray(header)) {
      throw invalidTripRequest();
    }
    const match = /^"([1-9]\d*)"$/.exec(header.trim());
    if (!match) {
      throw invalidTripRequest();
    }
    return match[1];
  }

  private formatEtag(revision: string): string {
    if (!revisionPattern.test(revision)) {
      throw tripStorageUnavailable();
    }
    return `"${revision}"`;
  }

  private async readInput(request: IncomingMessage) {
    if (
      request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
      'application/json'
    ) {
      throw new TripError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Content-Type을 application/json으로 지정해 주세요.',
      );
    }
    const json = await new Promise<unknown>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > TRIP_BODY_LIMIT) {
          chunks.length = 0;
          reject(
            new TripError(
              413,
              'REQUEST_TOO_LARGE',
              '요청 본문은 2MiB 이하여야 합니다.',
            ),
          );
        } else {
          chunks.push(chunk);
        }
      });
      request.on('end', () => {
        if (size > TRIP_BODY_LIMIT) {
          return;
        }
        try {
          resolve(
            JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
          );
        } catch {
          reject(invalidTripRequest());
        }
      });
      request.on('error', reject);
      request.on('aborted', () => reject(invalidTripRequest()));
    });
    const result = tripInputSchema.safeParse(json);
    if (!result.success) {
      throw invalidTripRequest();
    }
    return result.data;
  }
}
