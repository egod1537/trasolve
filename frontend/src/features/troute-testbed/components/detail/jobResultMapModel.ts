import type {
  PlaceDetails,
  TrouteOptimizeRequest,
  TrouteOptimizeResponse,
} from '@trasolve/shared';
import type { TestbedJobStatus } from '@/entities/route-job';
import type { GeoPoint } from '@/shared/types/mapTypes';
import { L } from '@/shared/i18n';

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
    return {
      kind: 'error',
      message: L(
        'testbed:jobResultMapModel.createOptimizedMapContent.message.thereNoOptimizationResultsCompletedJob',
      ),
    };
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
      message: L(
        'testbed:jobResultMapModel.createOptimizedMapContent.message.optimizationResultReferencesLocationIdThat',
        { value: unknownLocationIds.join(', ') },
      ),
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
    throw new Error(
      L(
        'testbed:jobResultMapModel.createOptimizedMapContent.message.optimizationResultReferencesLocationIdThat',
        { value: request.id },
      ),
    );
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
      return L(
        'testbed:jobResultMapModel.getStatusMessage.text.waitingOptimizationRun',
      );
    case 'running':
      return L(
        'testbed:jobResultMapModel.getStatusMessage.text.optimizationProgress',
      );
    case 'failed':
      return L(
        'testbed:jobResultMapModel.getStatusMessage.text.resultingMapCannotBeDisplayedBecause',
      );
    case 'cancelled':
      return L(
        'testbed:jobResultMapModel.getStatusMessage.text.jobHasBeenCanceledResultingMap',
      );
  }
}
