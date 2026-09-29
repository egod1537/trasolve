import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  updateTripShareRequestSchema,
  type ApiErrorResponse,
} from '@trasolve/shared';
import {
  AuthenticationRequiredError,
  type CurrentUserResolver,
} from '../auth/currentUserResolver.js';
import {
  invalidTripShareRequest,
  TripShareError,
  tripShareAuthenticationRequired,
  tripShareNotFound,
  tripShareStorageUnavailable,
} from './errors.js';
import type { TripShareController } from './tripShareController.js';

const SHARE_REQUEST_BODY_LIMIT = 1024;

export class TripShareHttpService {
  public constructor(
    private readonly controller: TripShareController,
    private readonly currentUser: CurrentUserResolver,
  ) {}

  public async handleOwner(
    request: IncomingMessage,
    response: ServerResponse,
    encodedTripId: string,
  ): Promise<void> {
    await this.respond(response, async () => {
      if (request.method !== 'GET' && request.method !== 'PUT') {
        response.setHeader('Allow', 'GET, PUT');
        throw new TripShareError(
          405,
          'METHOD_NOT_ALLOWED',
          '지원하지 않는 요청 방식입니다.',
        );
      }
      const actorUserId = await this.currentUser.require(request);
      const tripId = this.decode(encodedTripId);
      return request.method === 'GET'
        ? this.controller.getSettings(actorUserId, tripId)
        : this.controller.updateSettings(
            actorUserId,
            tripId,
            await this.readUpdateInput(request),
          );
    });
  }

  public async handlePublic(
    request: IncomingMessage,
    response: ServerResponse,
    encodedToken: string,
  ): Promise<void> {
    await this.respond(response, async () => {
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        throw new TripShareError(
          405,
          'METHOD_NOT_ALLOWED',
          '지원하지 않는 요청 방식입니다.',
        );
      }
      return this.controller.getSharedTrip(
        this.decodePublicToken(encodedToken),
        await this.currentUser.resolve(request),
      );
    });
  }

  private async respond(
    response: ServerResponse,
    operation: () => Promise<unknown>,
  ): Promise<void> {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    try {
      const body = await operation();
      if (!response.destroyed) {
        response.writeHead(200);
        response.end(JSON.stringify(body));
      }
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error =
        cause instanceof TripShareError
          ? cause
          : cause instanceof AuthenticationRequiredError
            ? tripShareAuthenticationRequired()
            : tripShareStorageUnavailable();
      const body: ApiErrorResponse = {
        error: { code: error.code, message: error.message },
      };
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private decode(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      throw invalidTripShareRequest();
    }
  }

  private decodePublicToken(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      throw tripShareNotFound();
    }
  }

  private async readUpdateInput(request: IncomingMessage) {
    if (
      request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
      'application/json'
    ) {
      throw new TripShareError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Content-Type을 application/json으로 지정해 주세요.',
      );
    }
    const chunks: Buffer[] = [];
    let size = 0;
    const body = await new Promise<unknown>((resolve, reject) => {
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > SHARE_REQUEST_BODY_LIMIT) {
          chunks.length = 0;
          reject(invalidTripShareRequest());
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > SHARE_REQUEST_BODY_LIMIT) {
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(invalidTripShareRequest());
        }
      });
      request.on('error', reject);
      request.on('aborted', () => reject(invalidTripShareRequest()));
    });
    const parsed = updateTripShareRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw invalidTripShareRequest();
    }
    return parsed.data;
  }
}
