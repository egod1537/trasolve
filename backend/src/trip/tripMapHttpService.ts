import type { IncomingMessage, ServerResponse } from 'node:http';
import { TRIP_BODY_LIMIT, tripMapInputSchema } from '@trasolve/shared';
import type { TripMapController } from './tripMapController.js';
import {
  TripError,
  invalidTripRequest,
  tripStorageUnavailable,
} from './errors.js';

export type CurrentUserResolver = (
  request: IncomingMessage,
) => string | Promise<string>;

export class TripMapHttpService {
  public constructor(
    private readonly controller: TripMapController,
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
      let tripId: string | undefined;
      try {
        tripId =
          encodedTripId === undefined
            ? undefined
            : decodeURIComponent(encodedTripId);
      } catch {
        throw invalidTripRequest();
      }
      const userId = await this.currentUser(request);
      let body: unknown;
      let status = 200;
      switch (request.method) {
        case 'GET':
          body =
            tripId === undefined
              ? await this.controller.listTrips(userId)
              : await this.controller.getTrip(userId, tripId);
          break;
        case 'POST':
          body = await this.controller.createTrip(
            userId,
            await this.readInput(request),
          );
          status = 201;
          break;
        case 'PUT':
          body = await this.controller.saveTrip(
            userId,
            tripId!,
            await this.readInput(request),
          );
          break;
        case 'DELETE':
          await this.controller.deleteTrip(userId, tripId!);
          status = 204;
          break;
      }
      if (response.destroyed) return;
      response.writeHead(status);
      response.end(status === 204 ? undefined : JSON.stringify(body));
    } catch (cause) {
      if (response.destroyed) return;
      const error =
        cause instanceof TripError ? cause : tripStorageUnavailable();
      response.writeHead(error.status);
      response.end(
        JSON.stringify({ error: { code: error.code, message: error.message } }),
      );
    }
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
        } else chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > TRIP_BODY_LIMIT) return;
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
    const result = tripMapInputSchema.safeParse(json);
    if (!result.success) throw invalidTripRequest();
    return result.data;
  }
}
