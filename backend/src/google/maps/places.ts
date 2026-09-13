import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import {
  placeAutocompleteRequestSchema,
  placeAutocompleteResponseSchema,
  placeDetailsRequestSchema,
  placeDetailsSchema,
  placeIdSchema,
  placeOpeningScheduleSchema,
  type ApiErrorResponse,
  type PlaceAutocompleteRequest,
  type PlaceAutocompleteResponse,
  type PlaceDetailsRequest,
  type PlaceDetails,
} from '@trasolve/shared';
import { ApiError } from './errors.js';

export class Places {
  public constructor(
    apiKey: string,
    private readonly timeoutMs = 15000,
  ) {
    this.apiKey = apiKey.trim();
  }

  public async searchAutocomplete(
    request: PlaceAutocompleteRequest,
  ): Promise<PlaceAutocompleteResponse> {
    const input = this.validateRequest(placeAutocompleteRequestSchema, request);
    const raw = await this.fetchGoogle('places:autocomplete', {
      method: 'POST',
      fieldMask:
        'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text,suggestions.placePrediction.types',
      body: JSON.stringify({
        input: input.input,
        languageCode: input.languageCode ?? 'ko',
        regionCode: input.regionCode ?? 'JP',
        sessionToken: input.sessionToken,
        includeQueryPredictions: false,
        locationBias: input.locationBias
          ? {
              circle: {
                center: {
                  latitude: input.locationBias.lat,
                  longitude: input.locationBias.lng,
                },
                radius: input.locationBias.radiusMeters,
              },
            }
          : undefined,
      }),
    });
    const result = this.validateResponse(Places.autocompleteSchema, raw);
    return this.validateResponse(placeAutocompleteResponseSchema, {
      suggestions: result.suggestions.map(({ placePrediction }) => ({
        placeId: placePrediction.placeId,
        text: placePrediction.structuredFormat.mainText.text,
        secondaryText:
          placePrediction.structuredFormat.secondaryText?.text ?? '',
        types: placePrediction.types,
      })),
    });
  }

  public async getPlace(request: PlaceDetailsRequest): Promise<PlaceDetails> {
    const input = this.validateRequest(placeDetailsRequestSchema, request);
    const query = new URLSearchParams({
      languageCode: input.languageCode ?? 'ko',
      regionCode: input.regionCode ?? 'JP',
    });
    if (input.sessionToken) {
      query.set('sessionToken', input.sessionToken);
    }
    const raw = await this.fetchGoogle(
      `places/${encodeURIComponent(input.placeId)}?${query}`,
      {
        method: 'GET',
        fieldMask:
          'id,displayName,formattedAddress,location,rating,userRatingCount,websiteUri,nationalPhoneNumber,internationalPhoneNumber,googleMapsUri,primaryType,primaryTypeDisplayName,currentOpeningHours,regularOpeningHours,timeZone,utcOffsetMinutes',
      },
    );
    const place = this.validateResponse(Places.detailsSchema, raw);
    return this.validateResponse(placeDetailsSchema, {
      id: place.id,
      name: place.displayName?.text ?? place.formattedAddress ?? '선택한 장소',
      address: place.formattedAddress,
      location: {
        lat: place.location.latitude,
        lng: place.location.longitude,
      },
      rating: place.rating,
      userRatingCount: place.userRatingCount,
      website: place.websiteUri,
      phoneNumber: place.internationalPhoneNumber ?? place.nationalPhoneNumber,
      googleMapsUrl: place.googleMapsUri,
      category: place.primaryTypeDisplayName?.text ?? place.primaryType,
      openingHours:
        place.currentOpeningHours || place.regularOpeningHours
          ? {
              timeZone: place.timeZone?.id,
              utcOffsetMinutes: place.utcOffsetMinutes,
              current: place.currentOpeningHours,
              regular: place.regularOpeningHours,
            }
          : undefined,
    });
  }

  public async handleAutocomplete(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    await this.handleRequest(request, response, 'POST', async () => {
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
      return this.searchAutocomplete(
        this.validateRequest(
          placeAutocompleteRequestSchema,
          await this.readJson(request),
        ),
      );
    });
  }

  public async handlePlace(
    request: IncomingMessage,
    response: ServerResponse,
    encodedPlaceId: string,
  ) {
    await this.handleRequest(request, response, 'GET', async () => {
      let placeId: string;
      try {
        placeId = decodeURIComponent(encodedPlaceId);
      } catch {
        throw this.invalidRequest();
      }
      const query = new URL(request.url ?? '/', 'http://localhost')
        .searchParams;
      const options: Record<string, string> = {};
      for (const [key, value] of query) {
        if (
          !['languageCode', 'regionCode', 'sessionToken'].includes(key) ||
          key in options
        ) {
          throw this.invalidRequest();
        }
        options[key] = value;
      }
      return this.getPlace(
        this.validateRequest(placeDetailsRequestSchema, {
          ...options,
          placeId,
        }),
      );
    });
  }

  private readonly apiKey: string;
  private readonly maxBodyBytes = 16384;

  private static readonly autocompleteSchema = z.object({
    suggestions: z
      .array(
        z.object({
          placePrediction: z.object({
            placeId: placeIdSchema,
            types: z.array(z.string().min(1).max(100)).max(32).default([]),
            structuredFormat: z.object({
              mainText: z.object({ text: z.string().min(1) }),
              secondaryText: z.object({ text: z.string() }).optional(),
            }),
          }),
        }),
      )
      .default([]),
  });

  private static readonly detailsSchema = z.object({
    id: placeIdSchema,
    displayName: z.object({ text: z.string().min(1) }).optional(),
    formattedAddress: z.string().min(1).optional(),
    location: z.object({
      latitude: z.number().min(-90).max(90).default(0),
      longitude: z.number().min(-180).max(180).default(0),
    }),
    rating: z.number().min(1).max(5).optional(),
    userRatingCount: z.number().int().nonnegative().optional(),
    websiteUri: z.string().url().optional(),
    nationalPhoneNumber: z.string().min(1).optional(),
    internationalPhoneNumber: z.string().min(1).optional(),
    googleMapsUri: z.string().url().optional(),
    primaryType: z.string().min(1).optional(),
    primaryTypeDisplayName: z.object({ text: z.string().min(1) }).optional(),
    currentOpeningHours: placeOpeningScheduleSchema.optional(),
    regularOpeningHours: placeOpeningScheduleSchema.optional(),
    timeZone: z.object({ id: z.string().min(1).max(100) }).optional(),
    utcOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  });

  private async fetchGoogle(
    path: string,
    options: { method: 'POST' | 'GET'; fieldMask: string; body?: string },
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new ApiError(
        503,
        'PLACES_NOT_CONFIGURED',
        '서버의 GOOGLE_PLACES_API_KEY를 설정해 주세요.',
      );
    }
    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': options.fieldMask,
        },
        body: options.body,
        signal,
      });
      if (!response.ok) {
        // Never relay Google's error body or request credentials to the client.
        void response.body?.cancel().catch(() => {});
        if (response.status === 400) {
          throw this.invalidRequest();
        }
        if (response.status === 404 && options.method === 'GET') {
          throw new ApiError(
            404,
            'PLACE_NOT_FOUND',
            '장소를 찾을 수 없습니다.',
          );
        }
        throw new ApiError(
          502,
          'PLACES_UNAVAILABLE',
          'Google 장소 조회에 실패했습니다.',
        );
      }
      return await response.json();
    } catch (cause) {
      if (cause instanceof ApiError) {
        throw cause;
      }
      if (signal.aborted) {
        throw new ApiError(
          504,
          'PLACES_TIMEOUT',
          '장소 조회 시간이 초과됐습니다.',
        );
      }
      throw new ApiError(
        502,
        'PLACES_UNAVAILABLE',
        'Google 장소 서버에 연결할 수 없습니다.',
      );
    }
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    method: 'GET' | 'POST',
    action: () => Promise<PlaceAutocompleteResponse | PlaceDetails>,
  ) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== method) {
        response.setHeader('Allow', method);
        throw new ApiError(
          405,
          'METHOD_NOT_ALLOWED',
          `${method} 요청을 사용해 주세요.`,
        );
      }
      const result = await action();
      if (response.destroyed) {
        return;
      }
      response.writeHead(200);
      response.end(JSON.stringify(result));
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error =
        cause instanceof ApiError
          ? cause
          : new ApiError(
              500,
              'INTERNAL_ERROR',
              '장소 요청을 처리할 수 없습니다.',
            );
      const body: ApiErrorResponse = {
        error: { code: error.code, message: error.message },
      };
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private invalidRequest() {
    return new ApiError(
      400,
      'INVALID_PLACE_REQUEST',
      '장소 검색어, 장소 ID 또는 검색 옵션을 확인해 주세요.',
    );
  }

  private validateRequest<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw this.invalidRequest();
    }
    return parsed.data;
  }

  private validateResponse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new ApiError(
        502,
        'PLACES_UNAVAILABLE',
        'Google 장소 응답 형식이 올바르지 않습니다.',
      );
    }
    return parsed.data;
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
        if (size > this.maxBodyBytes) {
          return;
        }
        try {
          resolve(
            JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
          );
        } catch {
          reject(this.invalidRequest());
        }
      });
      request.on('error', reject);
      request.on('aborted', () => reject(this.invalidRequest()));
    });
  }
}
