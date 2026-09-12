import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import {
  directionsDebugDetailsSchema,
  directionsRequestSchema,
  TravelMode,
  type DirectionsDebugDetails,
  type DirectionsErrorResponse,
  type DirectionsRequest,
  type DirectionsResult,
  type MapRoute,
  type RouteLocation,
} from '@trasolve/shared';
import { ApiError } from './errors.js';

export class Routes {
  public constructor(
    apiKey: string,
    private readonly timeoutMs = 15000,
  ) {
    this.apiKey = apiKey.trim();
  }

  public async queryRoutes(
    request: DirectionsRequest,
  ): Promise<DirectionsResult> {
    if (
      request.travelMode === TravelMode.TRANSIT &&
      request.intermediates?.length
    ) {
      return this.computeTransitSegments(request);
    }
    return this.computeRoutes(request);
  }

  public async handle(request: IncomingMessage, response: ServerResponse) {
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
      const parsed = directionsRequestSchema.safeParse(
        await this.readJson(request),
      );
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
      const result = await this.queryRoutes(parsed.data);
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
      const parsedDetails = directionsDebugDetailsSchema.safeParse(
        error.details,
      );
      const body: DirectionsErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          ...(parsedDetails.success ? { details: parsedDetails.data } : {}),
        },
      };
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private readonly apiKey: string;
  private readonly maxBodyBytes = 16384;

  private static readonly latLngSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
  });
  private static readonly durationSchema = z
    .string()
    .regex(/^\d+(?:\.\d{1,9})?s$/);
  private static readonly locationSchema = z.object({
    latLng: Routes.latLngSchema,
  });
  private static readonly transitStopSchema = z.object({
    name: z.string().optional(),
    location: Routes.locationSchema.optional(),
  });
  private static readonly transitDetailsSchema = z.object({
    stopDetails: z
      .object({
        departureStop: Routes.transitStopSchema.optional(),
        arrivalStop: Routes.transitStopSchema.optional(),
        departureTime: z.string().optional(),
        arrivalTime: z.string().optional(),
      })
      .optional(),
    headsign: z.string().optional(),
    transitLine: z
      .object({
        name: z.string().optional(),
        nameShort: z.string().optional(),
        vehicle: z
          .object({
            type: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    stopCount: z.number().int().nonnegative().optional(),
  });
  private static readonly legStepSchema = z.object({
    distanceMeters: z.number().nonnegative().optional(),
    staticDuration: Routes.durationSchema.optional(),
    startLocation: Routes.locationSchema.optional(),
    endLocation: Routes.locationSchema.optional(),
    navigationInstruction: z
      .object({
        instructions: z.string().optional(),
      })
      .optional(),
    travelMode: z.string().optional(),
    transitDetails: Routes.transitDetailsSchema.optional(),
  });
  private static readonly legSchema = z.object({
    distanceMeters: z.number().nonnegative().optional(),
    duration: Routes.durationSchema.optional(),
    startLocation: Routes.locationSchema.optional(),
    endLocation: Routes.locationSchema.optional(),
    steps: z.array(Routes.legStepSchema).default([]),
  });
  private static readonly moneySchema = z.object({
    currencyCode: z.string().optional(),
    units: z.string().optional(),
    nanos: z.number().int().optional(),
  });
  private static readonly responseSchema = z.object({
    routes: z
      .array(
        z.object({
          description: z.string().optional(),
          distanceMeters: z.number().nonnegative().optional(),
          duration: Routes.durationSchema.optional(),
          travelAdvisory: z
            .object({
              transitFare: Routes.moneySchema.optional(),
            })
            .optional(),
          legs: z.array(Routes.legSchema).default([]),
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
  private static readonly upstreamErrorResponseSchema = z.object({
    error: z.object({
      status: z.string().optional(),
      message: z.string().optional(),
    }),
  });

  private static readonly travelModes: Readonly<Record<TravelMode, string>> = {
    [TravelMode.DRIVING]: 'DRIVE',
    [TravelMode.WALKING]: 'WALK',
    [TravelMode.BICYCLING]: 'BICYCLE',
    [TravelMode.TRANSIT]: 'TRANSIT',
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
    signal = AbortSignal.timeout(this.timeoutMs),
  ): Promise<DirectionsResult> {
    if (!this.apiKey) {
      throw new ApiError(
        503,
        'ROUTES_NOT_CONFIGURED',
        '서버의 GOOGLE_ROUTES_API_KEY를 설정해 주세요.',
      );
    }

    try {
      const upstreamRequest = this.buildRequest(request);
      const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask':
              'routes.description,routes.distanceMeters,routes.duration,routes.travelAdvisory.transitFare,routes.legs.distanceMeters,routes.legs.duration,routes.legs.startLocation,routes.legs.endLocation,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.travelMode,routes.legs.steps.transitDetails.stopDetails,routes.legs.steps.transitDetails.headsign,routes.legs.steps.transitDetails.transitLine.name,routes.legs.steps.transitDetails.transitLine.nameShort,routes.legs.steps.transitDetails.transitLine.vehicle.type,routes.legs.steps.transitDetails.stopCount,routes.polyline.geoJsonLinestring,routes.viewport,routes.warnings',
          },
          signal,
          body: JSON.stringify(upstreamRequest),
        },
      );
      const rawResponse = await this.readUpstreamBody(response);
      if (!response.ok) {
        throw this.upstreamError(
          response.status,
          rawResponse,
          request,
          upstreamRequest,
        );
      }
      const debug = this.buildDebugDetails(
        request,
        upstreamRequest,
        response.status,
      );
      const result = this.normalizeResponse(request, rawResponse, debug);
      if (result.routes.length === 0) {
        throw new ApiError(
          422,
          'ROUTE_NOT_FOUND',
          request.travelMode === TravelMode.TRANSIT
            ? 'Google Routes API가 대중교통 경로를 반환하지 않았습니다. 지역 지원 범위와 운행 시간을 확인해 주세요.'
            : 'Google Routes API가 이 요청에 경로를 반환하지 않았습니다.',
          this.buildDebugDetails(
            request,
            upstreamRequest,
            response.status,
            rawResponse,
          ),
        );
      }
      return { ...result, debug };
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

  private async computeTransitSegments(
    request: DirectionsRequest,
  ): Promise<DirectionsResult> {
    const locations = [
      request.origin,
      ...(request.intermediates ?? []),
      request.destination,
    ];
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(this.timeoutMs),
    ]);
    try {
      const results = await Promise.all(
        locations.slice(1).map((destination, index) =>
          this.computeRoutes(
            {
              origin: locations[index],
              destination,
              travelMode: TravelMode.TRANSIT,
              computeAlternativeRoutes: false,
            },
            signal,
          ),
        ),
      );
      const rawResponse = {
        segments: results.map((result) => ({
          request: result.request,
          response: result.rawResponse,
        })),
      };
      const segments = results.flatMap((result) => result.routes.slice(0, 1));
      if (segments.length !== results.length) {
        return { request, routes: [], rawResponse };
      }
      return {
        request,
        routes: [this.mergeTransitSegments(segments)],
        rawResponse,
      };
    } finally {
      // Cancel remaining upstream calls if any segment fails.
      controller.abort();
    }
  }

  private mergeTransitSegments(segments: MapRoute[]): MapRoute {
    const path: MapRoute['path'] = [];
    let bounds: MapRoute['bounds'] = null;
    let distanceMeters: number | null = 0;
    let durationMillis: number | null = 0;
    const segmentFares = segments.map((segment) => segment.fare);
    const fare =
      segmentFares.every(
        (item) =>
          item !== null && item.currencyCode === segmentFares[0]?.currencyCode,
      ) && segmentFares[0]
        ? {
            amount: segmentFares.reduce(
              (total, item) => total + (item?.amount ?? 0),
              0,
            ),
            currencyCode: segmentFares[0].currencyCode,
          }
        : null;
    for (const segment of segments) {
      distanceMeters =
        distanceMeters === null || segment.distanceMeters === null
          ? null
          : distanceMeters + segment.distanceMeters;
      durationMillis =
        durationMillis === null || segment.durationMillis === null
          ? null
          : durationMillis + segment.durationMillis;
      for (const point of segment.path) {
        const previous = path[path.length - 1];
        if (
          !previous ||
          previous.lat !== point.lat ||
          previous.lng !== point.lng
        ) {
          path.push(point);
        }
        bounds = bounds
          ? {
              north: Math.max(bounds.north, point.lat),
              south: Math.min(bounds.south, point.lat),
              east: Math.max(bounds.east, point.lng),
              west: Math.min(bounds.west, point.lng),
            }
          : {
              north: point.lat,
              south: point.lat,
              east: point.lng,
              west: point.lng,
            };
      }
    }
    return {
      description: `경유지를 포함한 대중교통 경로 (${segments.length}개 구간)`,
      distanceMeters,
      durationMillis,
      fare,
      legs: segments.flatMap((segment) => segment.legs),
      path,
      bounds,
      warnings: [
        ...new Set([
          '구간별 조회 결과를 합친 경로입니다. 구간 사이의 시간표 연결, 환승 대기 및 경유지 체류 시간은 반영하지 않습니다.',
          '각 구간의 첫 번째 경로를 연결하며, 전체 여정의 대체 경로는 제공하지 않습니다.',
          ...segments.flatMap((segment) => segment.warnings),
        ]),
      ],
    };
  }

  private buildRequest(request: DirectionsRequest) {
    return {
      origin: this.toWaypoint(request.origin),
      destination: this.toWaypoint(request.destination),
      intermediates: request.intermediates?.map((location) =>
        this.toWaypoint(location),
      ),
      travelMode: Routes.travelModes[request.travelMode ?? TravelMode.DRIVING],
      computeAlternativeRoutes: request.computeAlternativeRoutes ?? false,
      polylineEncoding: 'GEO_JSON_LINESTRING',
      languageCode: 'ko',
      regionCode: 'JP',
    };
  }

  private upstreamError(
    httpStatus: number,
    rawErrorBody: unknown,
    request: DirectionsRequest,
    upstreamRequest: unknown,
  ): ApiError {
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
    const googleError =
      Routes.upstreamErrorResponseSchema.safeParse(rawErrorBody);
    const googleMessage = googleError.success
      ? googleError.data.error.message?.trim()
      : undefined;
    return new ApiError(
      status,
      code,
      googleMessage ? `${message} Google: ${googleMessage}` : message,
      this.buildDebugDetails(
        request,
        upstreamRequest,
        httpStatus,
        rawErrorBody,
      ),
    );
  }

  private normalizeResponse(
    request: DirectionsRequest,
    rawResponse: unknown,
    debug: DirectionsDebugDetails,
  ): DirectionsResult {
    const parsed = Routes.responseSchema.safeParse(rawResponse);
    if (!parsed.success) {
      throw new ApiError(
        502,
        'INVALID_ROUTES_RESPONSE',
        'Google 경로 응답 형식이 올바르지 않습니다.',
        {
          ...debug,
          upstream: { ...debug.upstream, rawErrorBody: rawResponse },
        },
      );
    }
    return {
      request,
      routes: parsed.data.routes.map((route) => ({
        description: route.description ?? '',
        distanceMeters: route.distanceMeters ?? null,
        durationMillis: this.durationToMillis(route.duration),
        fare: this.normalizeFare(route.travelAdvisory?.transitFare),
        legs: route.legs.map((leg) => ({
          distanceMeters: leg.distanceMeters ?? null,
          durationMillis: this.durationToMillis(leg.duration),
          startLocation: this.normalizeLocation(leg.startLocation),
          endLocation: this.normalizeLocation(leg.endLocation),
          steps: leg.steps.map((step) => ({
            travelMode: step.travelMode ?? null,
            distanceMeters: step.distanceMeters ?? null,
            durationMillis: this.durationToMillis(step.staticDuration),
            instruction: step.navigationInstruction?.instructions ?? null,
            startLocation: this.normalizeLocation(step.startLocation),
            endLocation: this.normalizeLocation(step.endLocation),
            transitDetails: step.transitDetails
              ? {
                  departureStop:
                    step.transitDetails.stopDetails?.departureStop?.name ??
                    null,
                  arrivalStop:
                    step.transitDetails.stopDetails?.arrivalStop?.name ?? null,
                  departureTime:
                    step.transitDetails.stopDetails?.departureTime ?? null,
                  arrivalTime:
                    step.transitDetails.stopDetails?.arrivalTime ?? null,
                  lineName: step.transitDetails.transitLine?.name ?? null,
                  lineShortName:
                    step.transitDetails.transitLine?.nameShort ?? null,
                  headsign: step.transitDetails.headsign ?? null,
                  stopCount: step.transitDetails.stopCount ?? null,
                  vehicleType:
                    step.transitDetails.transitLine?.vehicle?.type ?? null,
                }
              : null,
          })),
        })),
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

  private buildDebugDetails(
    request: DirectionsRequest,
    upstreamRequest: unknown,
    httpStatus: number,
    rawErrorBody?: unknown,
  ): DirectionsDebugDetails {
    const googleError =
      Routes.upstreamErrorResponseSchema.safeParse(rawErrorBody);
    return {
      request: {
        travelMode: request.travelMode ?? TravelMode.DRIVING,
        originType: request.origin.type,
        destinationType: request.destination.type,
        computeAlternativeRoutes: request.computeAlternativeRoutes ?? false,
        intermediatesCount: request.intermediates?.length ?? 0,
      },
      upstream: {
        httpStatus,
        status: googleError.success
          ? (googleError.data.error.status ?? null)
          : null,
        message: googleError.success
          ? (googleError.data.error.message ?? null)
          : null,
        requestBody: upstreamRequest,
        ...(rawErrorBody === undefined ? {} : { rawErrorBody }),
      },
    };
  }

  private async readUpstreamBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private durationToMillis(duration: string | undefined): number | null {
    return duration === undefined
      ? null
      : Math.round(Number(duration.slice(0, -1)) * 1000);
  }

  private normalizeFare(
    fare: { currencyCode?: string; units?: string; nanos?: number } | undefined,
  ): MapRoute['fare'] {
    if (!fare?.currencyCode) return null;
    const units = Number(fare.units ?? '0');
    const amount = units + (fare.nanos ?? 0) / 1_000_000_000;
    return Number.isFinite(amount) && amount >= 0
      ? { amount, currencyCode: fare.currencyCode }
      : null;
  }

  private normalizeLocation(
    location: { latLng: { latitude: number; longitude: number } } | undefined,
  ): MapRoute['legs'][number]['startLocation'] {
    return location
      ? { lat: location.latLng.latitude, lng: location.latLng.longitude }
      : null;
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
}
