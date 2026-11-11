import { useRouteValidation } from './useRouteValidation';
import { useEffect, useId, useRef, useState } from 'react';
import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';
import {
  optimizeDayRoute,
  RouteOptimizationApiError,
  type RouteOptimizationFailure,
  type RouteOptimizationProgress,
} from '@/features/route-optimization/api/routeOptimizationApi';
import {
  createRouteOptimizationRequest,
  createRouteOptimizationSchedule,
  createTripScheduleUpdate,
  getBestOptimizationCandidate,
  getRouteOptimizationIssue,
  isApplicableCandidate,
  RouteOptimizationValidationError,
  type RouteOptimizationRequestOptions,
} from '@/features/route-optimization/model/routeOptimization';
import {
  cacheOptimization,
  getCachedOptimization,
  getOptimizationCacheKey,
} from '@/features/route-optimization/model/resultCache';
import {
  createDayOptimizationSettings,
  formatRouteOptimizationIssue,
} from '@/features/route-optimization/ui/optimizationSettings';
import { type RouteOptimizationProgressPhase } from '@/features/route-optimization/ui/RouteOptimizationProgressDialog';

import { useBilling } from '@/features/billing';
import { useL } from '@/shared/i18n';
import { trackEvent, useScreenView } from '@/shared/analytics';
import { type Props } from '@/features/route-optimization/model/optimizationModalTypes';

export function useOptimizationModal({ days, initialDayId, onCompare }: Props) {
  const L = useL();
  const billing = useBilling();
  useScreenView(ANALYTICS_SCREENS.routeOptimization);
  const titleId = useId();
  const validationId = useId();
  const controllerRef = useRef<AbortController | null>(null);
  const [dayId, setDayId] = useState(initialDayId ?? days[0]?.id ?? '');
  const [settingsByDay, setSettingsByDay] = useState<
    Record<string, RouteOptimizationRequestOptions>
  >(() =>
    Object.fromEntries(
      days.map((day) => [day.id, createDayOptimizationSettings(day)]),
    ),
  );
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<RouteOptimizationProgressPhase | null>(
    null,
  );
  const [progress, setProgress] = useState<RouteOptimizationProgress | null>(
    null,
  );
  const [error, setError] = useState<RouteOptimizationFailure | null>(null);
  const day = days.find((item) => item.id === dayId) ?? days[0];
  const settings = day
    ? (settingsByDay[day.id] ?? createDayOptimizationSettings(day))
    : null;
  const issue =
    day && settings ? getRouteOptimizationIssue(day, settings) : null;
  const validation = useRouteValidation(day, settings, phase !== null);
  let cached = false;
  if (day && settings && !issue) {
    try {
      const request = createRouteOptimizationRequest(day, settings);
      cached = Boolean(
        getCachedOptimization(getOptimizationCacheKey(day.id, request)),
      );
    } catch {
      /* Validation details are displayed by the existing issue UI. */
    }
  }
  const canAfford =
    cached ||
    !billing.summary ||
    billing.summary.unlimited ||
    billing.summary.wallet.remaining >= billing.summary.costs.optimize;
  useEffect(() => () => controllerRef.current?.abort(), []);
  const changeSettings = (patch: Partial<RouteOptimizationRequestOptions>) => {
    if (!day || !settings || running) {
      return;
    }
    setSettingsByDay((current) => ({
      ...current,
      [day.id]: { ...settings, ...patch },
    }));
    setError(null);
  };
  const run = async () => {
    if (
      !day ||
      !settings ||
      issue ||
      validation.blocksOptimization ||
      !canAfford ||
      controllerRef.current
    ) {
      return;
    }
    const sourceDay = structuredClone(day);
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setProgress(null);
    setError(null);
    setPhase('submitting');
    let started = false;
    const trackStarted = () => {
      if (started) {
        return;
      }
      started = true;
      trackEvent({
        eventType: 'optimize_start',
        screen: ANALYTICS_SCREENS.routeOptimization,
        target: ANALYTICS_TARGETS.optimizeStart,
        metadata: {
          source: 'route_optimization',
          success: true,
          travelMode: settings.travelMode,
        },
      });
    };
    try {
      const request = createRouteOptimizationRequest(sourceDay, settings);
      const cacheKey = getOptimizationCacheKey(sourceDay.id, request);
      const cachedResult = getCachedOptimization(cacheKey);
      const result =
        cachedResult ??
        (await optimizeDayRoute(
          request,
          (update) => {
            if (controller.signal.aborted) {
              return;
            }
            trackStarted();
            setProgress(update);
            setPhase('running');
          },
          controller.signal,
        ));
      if (controller.signal.aborted) {
        return;
      }
      if (!cachedResult) {
        trackStarted();
      }
      const candidate = getBestOptimizationCandidate(result);
      const schedule = createRouteOptimizationSchedule(
        result,
        candidate,
        sourceDay,
      );
      if (!schedule || !isApplicableCandidate(candidate, sourceDay, settings)) {
        throw new Error(
          L(
            'routeOptimization:routeOptimizationModal.tooltip.itCannotBeAppliedBecauseSchedule',
          ),
        );
      }
      cacheOptimization(cacheKey, result);
      if (!cachedResult) {
        trackEvent({
          eventType: 'optimize_complete',
          screen: ANALYTICS_SCREENS.routeOptimization,
          target: ANALYTICS_TARGETS.optimizeStart,
          metadata: {
            source: 'route_optimization',
            success: true,
            travelMode: settings.travelMode,
          },
        });
      }
      onCompare({
        day: sourceDay,
        fingerprint: JSON.stringify(sourceDay),
        travelMode: settings.travelMode,
        update: createTripScheduleUpdate(
          schedule,
          settings.selectedStartPlaceId,
          settings.selectedEndPlaceId,
          result.skipped_locations?.map((item) => item.location_id) ?? [],
        ),
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        setPhase('cancelled');
      } else {
        const message =
          cause instanceof RouteOptimizationValidationError
            ? formatRouteOptimizationIssue(cause.issue, L)
            : cause instanceof Error
              ? cause.message
              : L(
                  'routeOptimization:routeOptimizationModal.text.routeOptimizationRequestFailed',
                );
        setError({
          message,
          trouteError:
            cause instanceof RouteOptimizationApiError
              ? cause.trouteError
              : null,
        });
        setPhase('failed');
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      setRunning(false);
    }
  };
  if (!day || !settings) {
    return null;
  }
  return {
    L,
    titleId,
    validationId,
    controllerRef,
    setDayId,
    running,
    phase,
    setPhase,
    progress,
    error,
    setError,
    day,
    settings,
    issue,
    cached,
    validation,
    canAfford,
    changeSettings,
    run,
  };
}
