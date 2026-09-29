import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  AuthenticationRequiredError,
  type CurrentUserResolver,
} from '../auth/currentUserResolver.js';
import { TripPreviewError } from './errors.js';
import { TripError, invalidTripRequest } from '../trip/errors.js';
import type { TripController } from '../trip/tripController.js';
import type {
  GoogleStaticMapsProvider,
  TripPreviewImage,
} from './googleStaticMapsProvider.js';

// ~200 thumbnails of roughly 30-80 KB each stay well under 20 MB.
const MAX_CACHED_PREVIEWS = 200;
// Clients add ?v=<updatedAt>, so a cached response never outlives its Trip.
const BROWSER_CACHE_SECONDS = 24 * 60 * 60;

/**
 * GET /api/trips/:tripId/preview — owner-only map thumbnail. Images are cached
 * per stored revision, so Google is only called again after the Trip changes.
 */
export class TripPreviewHttpService {
  public constructor(
    private readonly controller: TripController,
    private readonly currentUser: CurrentUserResolver,
    private readonly provider: GoogleStaticMapsProvider,
  ) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    encodedTripId: string,
  ): Promise<void> {
    try {
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        throw new TripError(
          405,
          'METHOD_NOT_ALLOWED',
          '지원하지 않는 요청 방식입니다.',
        );
      }
      const actorUserId = await this.currentUser.require(request);
      const tripId = TripPreviewHttpService.decode(encodedTripId);
      // getTrip enforces ownership and throws TRIP_NOT_FOUND otherwise.
      const stored = await this.controller.getTrip(actorUserId, tripId);
      const cacheKey = `${actorUserId}\u0000${tripId}\u0000${stored.revision}`;
      const image = await this.load(cacheKey, stored.trip);
      if (response.destroyed) {
        return;
      }
      response.writeHead(200, {
        'Content-Type': image.contentType,
        'Content-Length': image.body.length,
        'Cache-Control': `private, max-age=${BROWSER_CACHE_SECONDS}`,
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(image.body);
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error = TripPreviewHttpService.toError(cause);
      response.writeHead(error.status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(
        JSON.stringify({ error: { code: error.code, message: error.message } }),
      );
    }
  }

  private readonly cache = new Map<string, TripPreviewImage>();
  private readonly pending = new Map<string, Promise<TripPreviewImage>>();

  private load(
    key: string,
    trip: Parameters<GoogleStaticMapsProvider['render']>[0],
  ): Promise<TripPreviewImage> {
    const cached = this.readCache(key);
    if (cached) {
      return Promise.resolve(cached);
    }
    // Cards often request the same thumbnail at once; call Google only once.
    let request = this.pending.get(key);
    if (!request) {
      request = this.provider
        .render(trip)
        .then((image) => this.writeCache(key, image))
        .finally(() => this.pending.delete(key));
      this.pending.set(key, request);
    }
    return request;
  }

  private readCache(key: string): TripPreviewImage | undefined {
    const image = this.cache.get(key);
    if (image) {
      // Refresh recency: Map iteration order is insertion order.
      this.cache.delete(key);
      this.cache.set(key, image);
    }
    return image;
  }

  private writeCache(key: string, image: TripPreviewImage): TripPreviewImage {
    this.cache.set(key, image);
    while (this.cache.size > MAX_CACHED_PREVIEWS) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.cache.delete(oldestKey);
    }
    return image;
  }

  private static decode(encodedTripId: string): string {
    try {
      return decodeURIComponent(encodedTripId);
    } catch {
      throw invalidTripRequest();
    }
  }

  private static toError(cause: unknown): {
    status: number;
    code: string;
    message: string;
  } {
    if (cause instanceof TripError || cause instanceof TripPreviewError) {
      return cause;
    }
    if (cause instanceof AuthenticationRequiredError) {
      return {
        status: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: '로그인이 필요합니다.',
      };
    }
    return {
      status: 503,
      code: 'TRIP_PREVIEW_UNAVAILABLE',
      message: '지도 미리보기를 만들 수 없습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
}
