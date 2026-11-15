import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  type TripDay,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { trackEvent } from '@/shared/analytics';
import { optimizeDayRoute } from '../api/routeOptimizationApi';
import type { RouteOptimizationProgress } from '../api/optimizationApiTypes';
import type { RouteComparisonData } from './routeComparison';
import {
  createRouteOptimizationRequest,
  createRouteOptimizationSchedule,
  createTripScheduleUpdate,
  getBestOptimizationCandidate,
  isApplicableCandidate,
  type RouteOptimizationRequestOptions,
} from './routeOptimization';
import {
  cacheOptimization,
  getCachedOptimization,
  getCachedOptimizationFrames,
  getOptimizationCacheKey,
  retainOptimizationFrame,
} from './resultCache';

export class InapplicableOptimizationResultError extends Error {
  public constructor() {
    super('INAPPLICABLE_OPTIMIZATION_RESULT');
  }
}

type Options = {
  day: TripDay;
  settings: RouteOptimizationRequestOptions;
  signal: AbortSignal;
  onProgress: (progress: RouteOptimizationProgress) => void;
  onPreview: (revision: number, result: TrouteOptimizeResponse) => void;
};

/** Fetch and cache authoritative results independently of UI playback. */
export async function runRouteOptimization({
  day,
  settings,
  signal,
  onProgress,
  onPreview,
}: Options): Promise<RouteComparisonData> {
  const request = createRouteOptimizationRequest(day, settings);
  const cacheKey = getOptimizationCacheKey(day.id, request);
  const cachedResult = getCachedOptimization(cacheKey);
  let frames = getCachedOptimizationFrames(cacheKey);
  let started = false;
  const trackStarted = () => {
    if (!started) {
      started = true;
      trackOptimization('optimize_start', settings);
    }
  };
  if (cachedResult) {
    for (const frame of frames) {
      onPreview(frame.revision, frame.result);
    }
  }
  const result =
    cachedResult ??
    (await optimizeDayRoute(
      request,
      (update) => {
        if (signal.aborted) {
          return;
        }
        trackStarted();
        onProgress(update);
        if (
          update.preview &&
          (update.status === 'running' || update.status === 'completed')
        ) {
          for (const frame of update.preview.frames ?? [update.preview]) {
            frames = retainOptimizationFrame(frames, frame);
            onPreview(frame.revision, frame.result);
          }
        }
      },
      signal,
    ));
  signal.throwIfAborted();
  if (!cachedResult) {
    trackStarted();
  }
  const comparison = createCompletedComparison(day, settings, result);
  cacheOptimization(cacheKey, result, frames);
  if (!cachedResult) {
    trackOptimization('optimize_complete', settings);
  }
  return comparison;
}

function createCompletedComparison(
  day: TripDay,
  settings: RouteOptimizationRequestOptions,
  result: TrouteOptimizeResponse,
): RouteComparisonData {
  const candidate = getBestOptimizationCandidate(result);
  const schedule = createRouteOptimizationSchedule(result, candidate, day);
  if (!schedule || !isApplicableCandidate(candidate, day, settings)) {
    throw new InapplicableOptimizationResultError();
  }
  return {
    day,
    fingerprint: JSON.stringify(day),
    travelMode: settings.travelMode,
    update: createTripScheduleUpdate(
      schedule,
      settings.selectedStartPlaceId,
      settings.selectedEndPlaceId,
      result.skipped_locations?.map((item) => item.location_id) ?? [],
    ),
  };
}

function trackOptimization(
  eventType: 'optimize_start' | 'optimize_complete',
  settings: RouteOptimizationRequestOptions,
) {
  trackEvent({
    eventType,
    screen: ANALYTICS_SCREENS.routeOptimization,
    target: ANALYTICS_TARGETS.optimizeStart,
    metadata: {
      source: 'route_optimization',
      success: true,
      travelMode: settings.travelMode,
    },
  });
}
