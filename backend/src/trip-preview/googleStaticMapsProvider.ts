import {
  GOOGLE_MAPS_DEFAULT_LANGUAGE_CODE,
  GOOGLE_MAPS_REGION_CODE,
  type Trip,
} from '@trasolve/shared';
import { TripPreviewError } from './errors.js';

export type TripPreviewImage = {
  body: Buffer;
  contentType: string;
};

type PreviewDay = {
  color: string;
  locations: Array<{ lat: number; lng: number }>;
};

const STATIC_MAPS_ENDPOINT = 'https://maps.googleapis.com/maps/api/staticmap';
// 16:10, rendered at 2x for the ~260px wide trip card.
const IMAGE_SIZE = '320x200';
const IMAGE_SCALE = '2';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// Google rejects URLs over 16,384 characters; keep a margin for the key.
const MAX_URL_LENGTH = 15_000;
const MAX_TOTAL_POINTS = 240;
// Single place (or one spot repeated): Static Maps would zoom to street level.
const SINGLE_LOCATION_ZOOM = '14';

function toStaticColor(hex: string, alpha = ''): string {
  return `0x${hex.replace('#', '').toLowerCase()}${alpha}`;
}

function formatLocation({ lat, lng }: { lat: number; lng: number }): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Keeps the first and last point and evenly samples the rest. */
function sample<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) {
    return [...items];
  }
  const step = (items.length - 1) / (limit - 1);
  return Array.from(
    { length: limit },
    (_, index) => items[Math.round(index * step)]!,
  );
}

/**
 * Renders a Trip thumbnail with the Google Maps Static API using a server-side
 * key. Google's response is relayed as an opaque image only.
 */
export class GoogleStaticMapsProvider {
  public constructor(
    apiKey: string,
    private readonly timeoutMs = 10_000,
  ) {
    this.apiKey = apiKey.trim();
  }

  public async render(trip: Pick<Trip, 'days'>): Promise<TripPreviewImage> {
    if (!this.apiKey) {
      throw new TripPreviewError(
        503,
        'TRIP_PREVIEW_NOT_CONFIGURED',
        '서버의 GOOGLE_STATIC_MAPS_API_KEY를 설정해 주세요.',
      );
    }
    const days = GoogleStaticMapsProvider.toPreviewDays(trip);
    if (days.length === 0) {
      throw new TripPreviewError(
        404,
        'TRIP_PREVIEW_EMPTY',
        '지도 미리보기를 만들 장소가 없습니다.',
      );
    }

    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      const response = await fetch(this.buildUrl(days), { signal });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.startsWith('image/')) {
        // Never relay Google's error body or the request URL (it holds the key).
        void response.body?.cancel().catch(() => {});
        throw GoogleStaticMapsProvider.unavailable();
      }
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0 || body.length > MAX_IMAGE_BYTES) {
        throw GoogleStaticMapsProvider.unavailable();
      }
      return { body, contentType };
    } catch (cause) {
      if (cause instanceof TripPreviewError) {
        throw cause;
      }
      if (signal.aborted) {
        throw new TripPreviewError(
          504,
          'TRIP_PREVIEW_TIMEOUT',
          '지도 미리보기 생성 시간이 초과됐습니다.',
        );
      }
      throw GoogleStaticMapsProvider.unavailable();
    }
  }

  private readonly apiKey: string;

  private buildUrl(days: readonly PreviewDay[]): string {
    const allLocations = days.flatMap((day) => day.locations);
    const pointsPerDay = Math.max(
      2,
      Math.floor(MAX_TOTAL_POINTS / days.length),
    );
    const singleSpot = allLocations.every(
      (location) =>
        location.lat === allLocations[0]!.lat &&
        location.lng === allLocations[0]!.lng,
    );

    const build = (includeMarkers: boolean, limit: number) => {
      const params = new URLSearchParams({
        size: IMAGE_SIZE,
        scale: IMAGE_SCALE,
        maptype: 'roadmap',
        language: GOOGLE_MAPS_DEFAULT_LANGUAGE_CODE,
        region: GOOGLE_MAPS_REGION_CODE,
      });
      if (singleSpot) {
        params.set('center', formatLocation(allLocations[0]!));
        params.set('zoom', SINGLE_LOCATION_ZOOM);
      }
      for (const day of days) {
        const locations = sample(day.locations, limit);
        if (locations.length > 1) {
          params.append(
            'path',
            [
              `color:${toStaticColor(day.color, 'cc')}`,
              'weight:4',
              ...locations.map(formatLocation),
            ].join('|'),
          );
        }
        // A path alone also frames the viewport, so markers are the first
        // thing dropped for long trips; a lone place always keeps its marker.
        if (includeMarkers || singleSpot || locations.length === 1) {
          params.append(
            'markers',
            [
              'size:tiny',
              `color:${toStaticColor(day.color)}`,
              ...locations.map(formatLocation),
            ].join('|'),
          );
        }
      }
      params.set('key', this.apiKey);
      return `${STATIC_MAPS_ENDPOINT}?${params.toString()}`;
    };

    // Shrink the request until it fits Google's URL limit.
    for (const [includeMarkers, limit] of [
      [true, pointsPerDay],
      [false, pointsPerDay],
      [false, Math.max(2, Math.floor(pointsPerDay / 3))],
      [false, 2],
    ] as const) {
      const url = build(includeMarkers, limit);
      if (url.length <= MAX_URL_LENGTH) {
        return url;
      }
    }
    throw new TripPreviewError(
      422,
      'TRIP_PREVIEW_TOO_LARGE',
      '장소가 너무 많아 지도 미리보기를 만들 수 없습니다.',
    );
  }

  private static toPreviewDays(trip: Pick<Trip, 'days'>): PreviewDay[] {
    return trip.days
      .map((day) => ({
        color: day.color,
        locations: [...day.places]
          .sort((a, b) => a.order - b.order)
          .map((place) => place.location)
          .filter(
            (location) =>
              Number.isFinite(location.lat) && Number.isFinite(location.lng),
          ),
      }))
      .filter((day) => day.locations.length > 0);
  }

  private static unavailable(): TripPreviewError {
    return new TripPreviewError(
      502,
      'TRIP_PREVIEW_UNAVAILABLE',
      '지도 미리보기를 가져오지 못했습니다.',
    );
  }
}
