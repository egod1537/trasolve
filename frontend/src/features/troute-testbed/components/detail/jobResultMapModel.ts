import type {
  PlaceDetails,
  TrouteOptimizeRequest,
  TrouteOptimizeResponse,
} from '@trasolve/shared';
import type { TestbedJobStatus } from '@/entities/route-job';
import type { GeoPoint } from '@/shared/types/mapTypes';

type RequestLocation = TrouteOptimizeRequest['locations'][number];
type RouteStop = TrouteOptimizeResponse['route'][number];

export interface JobComparisonLocation {
  key: string;
  request: RequestLocation;
  name: string;
  position: GeoPoint;
  stop?: RouteStop;
}

export type OptimizedMapContent =
  | { kind: 'ready'; locations: JobComparisonLocation[] }
  | { kind: 'placeholder'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'waiting-for-places' };

export function createInputComparisonLocations(
  requestLocations: readonly RequestLocation[],
  places: ReadonlyMap<string, PlaceDetails>,
): JobComparisonLocation[] {
  return requestLocations.map((location, index) =>
    createComparisonLocation(`input:${index}:${location.id}`, location, places),
  );
}

export function createOptimizedMapContent(
  status: TestbedJobStatus,
  requestLocations: readonly RequestLocation[],
  optimization: TrouteOptimizeResponse | null,
  places: ReadonlyMap<string, PlaceDetails> | null,
): OptimizedMapContent {
  if (status !== 'completed') {
    return { kind: 'placeholder', message: getStatusMessage(status) };
  }
  if (!optimization) {
    return { kind: 'error', message: '완료된 Job에 최적화 결과가 없습니다.' };
  }

  const requestById = new Map(
    requestLocations.map((location) => [location.id, location]),
  );
  const unknownLocationIds = [
    ...new Set(
      optimization.route
        .filter((stop) => !requestById.has(stop.location_id))
        .map((stop) => stop.location_id),
    ),
  ];
  if (unknownLocationIds.length > 0) {
    return {
      kind: 'error',
      message: `최적화 결과가 요청에 없는 location_id를 참조합니다: ${unknownLocationIds.join(', ')}`,
    };
  }
  if (!places) {
    return { kind: 'waiting-for-places' };
  }

  return {
    kind: 'ready',
    locations: optimization.route.map((stop, index) => {
      const request = requestById.get(stop.location_id)!;
      return {
        ...createComparisonLocation(
          `optimized:${index}:${stop.location_id}`,
          request,
          places,
        ),
        stop,
      };
    }),
  };
}

function createComparisonLocation(
  key: string,
  request: RequestLocation,
  places: ReadonlyMap<string, PlaceDetails>,
): JobComparisonLocation {
  const place = places.get(request.place_id);
  if (!place) {
    throw new Error(`지도 장소 정보를 찾을 수 없습니다: ${request.id}`);
  }
  return {
    key,
    request,
    name: place.name,
    position: place.location,
  };
}

function getStatusMessage(status: Exclude<TestbedJobStatus, 'completed'>) {
  switch (status) {
    case 'pending':
      return '최적화 실행을 기다리고 있습니다.';
    case 'running':
      return '최적화가 진행 중입니다.';
    case 'failed':
      return '최적화에 실패해 결과 지도를 표시할 수 없습니다.';
    case 'cancelled':
      return 'Job이 취소되어 결과 지도를 표시할 수 없습니다.';
  }
}
