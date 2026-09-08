import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import {
  directionsRequestSchema,
  type ApiErrorResponse,
  type DirectionsRequest,
  type DirectionsResult,
  type RouteLocation,
  type TravelMode,
} from '@trasolve/shared';
import { ApiError } from './errors.js';

export class Routes {
  private readonly apiKey: string;
  private readonly maxBodyBytes = 16384;

  constructor(
    apiKey: string,
    private readonly timeoutMs = 15000,
  ) {
    this.apiKey = apiKey.trim();
  }

  private static readonly latLngSchema = z.object({
    latitude: z.number().default(0),
    longitude: z.number().default(0),
  });
  private static readonly responseSchema = z.object({
    routes: z
      .array(
        z.object({
          description: z.string().optional(),
          distanceMeters: z.number().nonnegative().optional(),
          duration: z
            .string()
            .regex(/^\d+(?:\.\d{1,9})?s$/)
            .optional(),
          polyline: z.object({
            geoJsonLinestring: z.object({
              type: z.literal('LineString'),
              coordinates: z.array(z.tuple([z.number(), z.number()])),
            }),
          }),
          viewport: z
            .object({
              low: Routes.latLngSchema,
              high: Routes.latLngSchema,
            })
            .optional(),
          warnings: z.array(z.string()).optional(),
        }),
      )
      .default([]),
  });

  private static readonly travelModes: Readonly<Record<TravelMode, string>> = {
    DRIVING: 'DRIVE',
    WALKING: 'WALK',
    BICYCLING: 'BICYCLE',
    TRANSIT: 'TRANSIT',
  };

  private toWaypoint(location: RouteLocation) {
    switch (location.type) {
      case 'place':
        return { placeId: location.placeId };
      case 'address':
        return { address: location.address };
      case 'coordinates':
        return {
          location: {
            latLng: { latitude: location.lat, longitude: location.lng },
          },
        };
    }
  }

  private async computeRoutes(
    request: DirectionsRequest,
  ): Promise<DirectionsResult> {
    if (!this.apiKey) {
      throw new ApiError(
        503,
        'ROUTES_NOT_CONFIGURED',
        '서버의 GOOGLE_ROUTES_API_KEY를 설정해 주세요.',
      );
    }

    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask':
              'routes.description,routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring,routes.viewport,routes.warnings',
          },
          signal,
          body: JSON.stringify(this.buildRequest(request)),
        },
      );
      if (!response.ok) {
        throw this.upstreamError(response.status);
      }
      const rawResponse: unknown = await response.json();
      return this.normalizeResponse(request, rawResponse);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (signal.aborted)
        throw new ApiError(
          504,
          'ROUTES_TIMEOUT',
          '경로 조회 시간이 초과됐습니다.',
        );
      throw new ApiError(
        502,
        'ROUTES_UNAVAILABLE',
        'Google 경로 서버에 연결할 수 없습니다.',
      );
    }
  }

  private buildRequest(request: DirectionsRequest) {
    return {
      origin: this.toWaypoint(request.origin),
      destination: this.toWaypoint(request.destination),
      intermediates: request.intermediates?.map((location) =>
        this.toWaypoint(location),
      ),
      travelMode: Routes.travelModes[request.travelMode ?? 'DRIVING'],
      computeAlternativeRoutes: request.computeAlternativeRoutes ?? false,
      polylineEncoding: 'GEO_JSON_LINESTRING',
      languageCode: 'ko',
      regionCode: 'JP',
    };
  }

  private upstreamError(httpStatus: number): ApiError {
    const errors: Record<number, [number, string, string]> = {
      400: [
        400,
        'ROUTE_REJECTED',
        '출발지·도착지 또는 경로 옵션을 확인해 주세요.',
      ],
      403: [
        502,
        'ROUTES_PERMISSION_DENIED',
        '서버 키의 Routes API 사용 권한과 제한 설정을 확인해 주세요.',
      ],
      429: [
        503,
        'ROUTES_QUOTA_EXCEEDED',
        '경로 조회 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
      ],
    };
    const [status, code, message] = errors[httpStatus] ?? [
      502,
      'ROUTES_UPSTREAM_ERROR',
      'Google 경로 조회에 실패했습니다.',
    ];
    return new ApiError(status, code, message);
  }

  private normalizeResponse(
    request: DirectionsRequest,
    rawResponse: unknown,
  ): DirectionsResult {
    const parsed = Routes.responseSchema.safeParse(rawResponse);
    if (!parsed.success) {
      throw new ApiError(
        502,
        'INVALID_ROUTES_RESPONSE',
        'Google 경로 응답 형식이 올바르지 않습니다.',
      );
    }
    return {
      request,
      routes: parsed.data.routes.map((route) => ({
        description: route.description ?? '',
        distanceMeters: route.distanceMeters ?? null,
        durationMillis:
          route.duration === undefined
            ? null
            : Math.round(Number(route.duration.slice(0, -1)) * 1000),
        path: route.polyline.geoJsonLinestring.coordinates.map(
          ([lng, lat]) => ({ lat, lng }),
        ),
        bounds: route.viewport
          ? {
              north: route.viewport.high.latitude,
              south: route.viewport.low.latitude,
              east: route.viewport.high.longitude,
              west: route.viewport.low.longitude,
            }
          : null,
        warnings: route.warnings ?? [],
      })),
      rawResponse,
    };
  }

  async getDirections(input: unknown): Promise<DirectionsResult> {
    const parsed = directionsRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new ApiError(
        400,
        'INVALID_ROUTE_REQUEST',
        '경로 요청을 확인해 주세요: ' +
          parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
      );
    }
    return this.computeRoutes(parsed.data);
  }

  private readJson(request: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.maxBodyBytes) {
          chunks.length = 0;
          reject(
            new ApiError(
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
        if (size > this.maxBodyBytes) return;
        try {
          resolve(
            JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
          );
        } catch {
          reject(
            new ApiError(
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

  async handle(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        throw new ApiError(
          405,
          'METHOD_NOT_ALLOWED',
          'POST 요청을 사용해 주세요.',
        );
      }
      if (
        request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
        'application/json'
      ) {
        throw new ApiError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Content-Type을 application/json으로 지정해 주세요.',
        );
      }
      const result = await this.getDirections(await this.readJson(request));
      response.writeHead(200);
      response.end(JSON.stringify(result));
    } catch (cause) {
      if (response.destroyed) return;
      const error =
        cause instanceof ApiError
          ? cause
          : new ApiError(
              500,
              'INTERNAL_ERROR',
              '경로 요청을 처리할 수 없습니다.',
            );
      const body: ApiErrorResponse = {
        error: { code: error.code, message: error.message },
      };
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }
}
