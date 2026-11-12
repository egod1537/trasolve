import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import {
  TravelMode,
  type DirectionsRequest,
  type MapRoute,
  type RouteLocation,
} from '@trasolve/shared';
import { TcacheClient } from '../../internal/tcache/tcacheClient.js';
import {
  TcacheClientError,
  type TcacheUpstreamResponse,
} from '../../internal/tcache/types.js';
import { RouteError } from '../routeError.js';
import {
  normalizeTransitDetails,
  upstreamTransitDetailsSchema,
} from './transitDetails.js';
import type { RouteProvider, RouteProviderResult } from '../routeProvider.js';

const pointSchema = z.union([
  z.object({ lat: z.number(), lng: z.number() }),
  z.object({ latitude: z.number(), longitude: z.number() }),
  z.tuple([z.number(), z.number()]),
]);

const boundsSchema = z.object({
  north: z.number(),
  south: z.number(),
  east: z.number(),
  west: z.number(),
});

const stepSchema = z
  .object({
    distanceMeters: z.number().nonnegative().nullish(),
    durationSeconds: z.number().nonnegative().nullish(),
    startLocation: pointSchema.nullish(),
    endLocation: pointSchema.nullish(),
    travelMode: z.string().nullish(),
    instruction: z.string().nullish(),
    transitDetails: upstreamTransitDetailsSchema.nullish(),
  })
  .passthrough();

const legSchema = z
  .object({
    distanceMeters: z.number().nonnegative().nullish(),
    durationSeconds: z.number().nonnegative().nullish(),
    startLocation: pointSchema.nullish(),
    endLocation: pointSchema.nullish(),
    steps: z.array(stepSchema).default([]),
  })
  .passthrough();

const routeSchema = z
  .object({
    description: z.string().nullish(),
    distanceMeters: z.number().nonnegative().nullish(),
    durationSeconds: z.number().nonnegative().nullish(),
    encodedPolyline: z.string().nullish(),
    path: z.array(pointSchema).default([]),
    bounds: boundsSchema.nullish(),
    fare: z
      .object({
        amount: z.number().nonnegative(),
        currencyCode: z.string().trim().min(1),
      })
      .nullish(),
    legs: z.array(legSchema).default([]),
    warnings: z.array(z.string()).default([]),
  })
  .passthrough();

const resultSchema = z
  .object({
    provider: z.string().optional(),
    routes: z.array(routeSchema),
  })
  .passthrough();

const resultEnvelopeSchema = z
  .object({
    result: resultSchema,
  })
  .passthrough();

const jobStatusSchema = z
  .object({
    jobId: z.string().optional(),
    status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
    message: z.string().optional(),
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const createJobSchema = z
  .object({
    jobId: z.string().trim().min(1),
    status: z
      .enum(['queued', 'running', 'completed', 'failed', 'cancelled'])
      .optional(),
  })
  .passthrough();

type TcachePoint = z.infer<typeof pointSchema>;
type TcacheRoute = z.infer<typeof routeSchema>;
type TcacheStep = z.infer<typeof stepSchema>;

export class TcacheRoutesProvider implements RouteProvider {
  public constructor(
    private readonly client: TcacheClient | null,
    private readonly timeoutMs = 18_000,
    private readonly pollIntervalMs = 300,
  ) {}

  public async queryRoutes(
    request: DirectionsRequest,
  ): Promise<RouteProviderResult> {
    if (!this.client) {
      throw new RouteError(
        503,
        'ROUTES_NOT_CONFIGURED',
        '서버의 TCACHE_BASE_URL을 설정해 주세요.',
        'tcache',
      );
    }

    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      const upstreamRequest = this.buildRequest(request);
      const created = createJobSchema.safeParse(
        this.readJson(
          await this.client.createJob(
            new TextEncoder().encode(JSON.stringify(upstreamRequest)),
            signal,
          ),
        ),
      );
      if (!created.success) {
        throw this.invalidResponse('작업 생성 응답');
      }

      await this.waitForCompletion(created.data.jobId, signal);
      const rawResponse = this.readJson(
        await this.client.getJobResult(created.data.jobId, signal),
      );
      const parsedEnvelope = resultEnvelopeSchema.safeParse(rawResponse);
      const directResult = parsedEnvelope.success
        ? null
        : resultSchema.safeParse(rawResponse);
      const result = parsedEnvelope.success
        ? parsedEnvelope.data.result
        : directResult?.success
          ? directResult.data
          : null;
      if (!result) {
        throw this.invalidResponse('경로 결과 응답');
      }

      const routes = result.routes.map((route) => this.normalizeRoute(route));
      if (routes.length === 0) {
        throw new RouteError(
          422,
          'ROUTE_NOT_FOUND',
          '요청한 이동수단의 경로를 찾지 못했습니다. 출발지·도착지와 이동수단을 확인해 주세요.',
          'tcache',
        );
      }
      return { routes, diagnostics: { rawResponse } };
    } catch (cause) {
      if (cause instanceof RouteError) {
        throw cause;
      }
      if (signal.aborted) {
        throw new RouteError(
          504,
          'ROUTES_TIMEOUT',
          '경로 조회 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.',
          'tcache',
        );
      }
      if (cause instanceof TcacheClientError) {
        throw this.clientError(cause);
      }
      throw new RouteError(
        502,
        'ROUTES_UNAVAILABLE',
        '경로 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
        'tcache',
      );
    }
  }

  private buildRequest(request: DirectionsRequest): Record<string, unknown> {
    const locations = [
      request.origin,
      ...(request.intermediates ?? []),
      request.destination,
    ];
    const countryCode = request.countryCode ?? this.inferCountryCode(locations);
    const travelMode = request.travelMode ?? TravelMode.DRIVING;
    return {
      locations: locations.map((location) => this.toTcacheLocation(location)),
      mode: travelMode,
      departureTime: new Date(Date.now() + 5 * 60_000).toISOString(),
      computeAlternativeRoutes: request.computeAlternativeRoutes ?? false,
      ...(request.languageCode ? { languageCode: request.languageCode } : {}),
      ...(countryCode
        ? { countryCode, regionCode: countryCode }
        : request.regionCode
          ? { regionCode: request.regionCode }
          : {}),
      ...(travelMode === TravelMode.DRIVING
        ? { routingPreference: 'TRAFFIC_AWARE' }
        : {}),
    };
  }

  private toTcacheLocation(location: RouteLocation): Record<string, unknown> {
    switch (location.type) {
      case 'coordinates':
        return { latitude: location.lat, longitude: location.lng };
      case 'place':
        return { placeId: location.placeId };
      case 'address':
        return { address: location.address };
    }
  }

  private inferCountryCode(
    locations: readonly RouteLocation[],
  ): string | undefined {
    if (
      locations.every(
        (location) =>
          location.type === 'coordinates' &&
          this.isSouthKoreanCoordinate(location.lat, location.lng),
      )
    ) {
      return 'KR';
    }
    return undefined;
  }

  private isSouthKoreanCoordinate(lat: number, lng: number): boolean {
    const isJeju = lat >= 33 && lat <= 33.7 && lng >= 126 && lng <= 127;
    const isMainland =
      lat >= 34.3 &&
      lat <= 38.7 &&
      lng >= 125 &&
      lng <= 129.7 &&
      !(lat < 34.8 && lng > 129);
    return isJeju || isMainland;
  }

  private async waitForCompletion(
    jobId: string,
    signal: AbortSignal,
  ): Promise<void> {
    while (!signal.aborted) {
      const parsed = jobStatusSchema.safeParse(
        this.readJson(await this.client!.getJob(jobId, signal)),
      );
      if (!parsed.success) {
        throw this.invalidResponse('작업 상태 응답');
      }
      switch (parsed.data.status) {
        case 'completed':
          return;
        case 'failed':
          throw this.failedJob(
            parsed.data.error?.code,
            parsed.data.error?.message ?? parsed.data.message,
          );
        case 'cancelled':
          throw new RouteError(
            502,
            'ROUTES_CANCELLED',
            '경로 조회 작업이 취소됐습니다. 다시 시도해 주세요.',
            'tcache',
          );
        case 'queued':
        case 'running':
          await delay(this.pollIntervalMs, undefined, { signal });
      }
    }
  }

  private failedJob(code?: string, message?: string): RouteError {
    if (code === 'ROUTE_NOT_FOUND' || code === 'ZERO_RESULTS') {
      return new RouteError(
        422,
        'ROUTE_NOT_FOUND',
        message ??
          '요청한 이동수단의 경로를 찾지 못했습니다. 출발지·도착지와 이동수단을 확인해 주세요.',
        'tcache',
      );
    }
    if (code === 'INVALID_ROUTE_OPTIONS' || code === 'INVALID_ARGUMENT') {
      return new RouteError(
        400,
        code,
        message ?? '경로 요청 옵션을 확인해 주세요.',
        'tcache',
      );
    }
    if (code === 'PROVIDER_UNAVAILABLE' || code === 'PROVIDER_NOT_CONFIGURED') {
      return new RouteError(
        503,
        code,
        message ??
          '선택된 이동수단의 경로 제공자를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
        'tcache',
      );
    }
    return new RouteError(
      502,
      code || 'ROUTES_UPSTREAM_ERROR',
      message ??
        '경로 제공자가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      'tcache',
    );
  }

  private normalizeRoute(route: TcacheRoute): MapRoute {
    const directPath = route.path.map((point) => this.normalizePoint(point));
    const path = directPath.length
      ? directPath
      : this.decodePolyline(route.encodedPolyline ?? '');
    return {
      description: route.description ?? '',
      distanceMeters: route.distanceMeters ?? null,
      durationMillis: this.secondsToMillis(route.durationSeconds),
      fare: route.fare ?? null,
      legs: route.legs.map((leg) => ({
        distanceMeters: leg.distanceMeters ?? null,
        durationMillis: this.secondsToMillis(leg.durationSeconds),
        startLocation: leg.startLocation
          ? this.normalizePoint(leg.startLocation)
          : null,
        endLocation: leg.endLocation
          ? this.normalizePoint(leg.endLocation)
          : null,
        steps: leg.steps.map((step) => this.normalizeStep(step)),
      })),
      path,
      bounds: route.bounds ?? this.boundsFromPath(path),
      warnings: route.warnings,
    };
  }

  private normalizeStep(
    step: TcacheStep,
  ): MapRoute['legs'][number]['steps'][number] {
    return {
      travelMode: this.normalizeTravelMode(step.travelMode),
      distanceMeters: step.distanceMeters ?? null,
      durationMillis: this.secondsToMillis(step.durationSeconds),
      instruction: step.instruction ?? null,
      startLocation: step.startLocation
        ? this.normalizePoint(step.startLocation)
        : null,
      endLocation: step.endLocation
        ? this.normalizePoint(step.endLocation)
        : null,
      transitDetails: normalizeTransitDetails(
        step.transitDetails,
        this.normalizeVehicleType(step.travelMode),
      ),
    };
  }

  private normalizeTravelMode(value: string | null | undefined): string | null {
    switch (value) {
      case 'DRIVE':
        return TravelMode.DRIVING;
      case 'WALK':
        return TravelMode.WALKING;
      case 'BICYCLE':
        return TravelMode.BICYCLING;
      case 'BUS':
      case 'SUBWAY':
      case 'TRAIN':
      case 'RAIL':
      case 'TRAM':
        return TravelMode.TRANSIT;
      default:
        return value ?? null;
    }
  }

  private normalizeVehicleType(
    value: string | null | undefined,
  ): string | null {
    switch (value) {
      case 'BUS':
      case 'SUBWAY':
      case 'TRAM':
        return value;
      case 'TRAIN':
      case 'RAIL':
        return 'RAIL';
      default:
        return null;
    }
  }

  private normalizePoint(point: TcachePoint): { lat: number; lng: number } {
    if (Array.isArray(point)) {
      const [first, second] = point;
      return Math.abs(first) > 90 && Math.abs(second) <= 90
        ? { lat: second, lng: first }
        : { lat: first, lng: second };
    }
    if ('lat' in point) {
      return point;
    }
    return { lat: point.latitude, lng: point.longitude };
  }

  private boundsFromPath(path: MapRoute['path']): MapRoute['bounds'] {
    return path.reduce<MapRoute['bounds']>(
      (bounds, point) =>
        bounds
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
            },
      null,
    );
  }

  private decodePolyline(value: string): MapRoute['path'] {
    const points: MapRoute['path'] = [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;
    while (index < value.length) {
      const latitudeDelta = this.decodePolylineValue(value, index);
      if (!latitudeDelta) {
        break;
      }
      index = latitudeDelta.nextIndex;
      const longitudeDelta = this.decodePolylineValue(value, index);
      if (!longitudeDelta) {
        break;
      }
      index = longitudeDelta.nextIndex;
      latitude += latitudeDelta.value;
      longitude += longitudeDelta.value;
      points.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
    }
    return points;
  }

  private decodePolylineValue(
    value: string,
    startIndex: number,
  ): { value: number; nextIndex: number } | null {
    let index = startIndex;
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      if (index >= value.length) {
        return null;
      }
      byte = value.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && shift < 32);
    return {
      value: result & 1 ? ~(result >> 1) : result >> 1,
      nextIndex: index,
    };
  }

  private secondsToMillis(value: number | null | undefined): number | null {
    return value === null || value === undefined
      ? null
      : Math.round(value * 1000);
  }

  private readJson(response: TcacheUpstreamResponse): unknown {
    const text = new TextDecoder().decode(response.body);
    if (!text) {
      throw this.invalidResponse('빈 응답');
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw this.invalidResponse('JSON 응답');
    }
  }

  private invalidResponse(context: string): RouteError {
    return new RouteError(
      502,
      'INVALID_ROUTES_RESPONSE',
      `tcache ${context} 형식이 올바르지 않습니다.`,
      'tcache',
    );
  }

  private clientError(error: TcacheClientError): RouteError {
    switch (error.kind) {
      case 'configuration':
        return new RouteError(
          503,
          'ROUTES_NOT_CONFIGURED',
          '서버의 TCACHE_BASE_URL을 설정해 주세요.',
          'tcache',
        );
      case 'timeout':
      case 'aborted':
        return new RouteError(
          504,
          'ROUTES_TIMEOUT',
          '경로 조회 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.',
          'tcache',
        );
      case 'upstream_http':
        return new RouteError(
          error.upstreamStatus === 429 ? 503 : 502,
          error.upstreamStatus === 429
            ? 'ROUTES_QUOTA_EXCEEDED'
            : 'ROUTES_UPSTREAM_ERROR',
          error.upstreamStatus === 429
            ? '경로 조회 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
            : `tcache가 HTTP ${error.upstreamStatus ?? 502} 오류를 반환했습니다. 잠시 후 다시 시도해 주세요.`,
          'tcache',
        );
      case 'invalid_response':
        return this.invalidResponse('응답');
      case 'unreachable':
        return new RouteError(
          502,
          'ROUTES_UNAVAILABLE',
          'tcache 경로 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
          'tcache',
        );
    }
  }
}
