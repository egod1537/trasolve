import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Trip } from '@trasolve/shared';
import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';
import type { TripEditController } from '@/features/map-workspace/controller/TripEditController';
import type {
  RouteComparisonData,
  RouteComparisonMode,
  RouteComparisonView,
} from '@/features/route-optimization';
import { useL } from '@/shared/i18n';
import { trackEvent } from '@/shared/analytics';

export function useRouteComparison(
  trip: Trip,
  controller: TripEditController,
  onApplied: (dayId: string) => void,
) {
  const L = useL();
  const [data, setData] = useState<RouteComparisonData | null>(null);
  const [mode, setMode] = useState<RouteComparisonMode>('result');
  const [applying, setApplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applyingRef = useRef(false);
  const latestTrip = useRef(trip);
  useLayoutEffect(() => {
    latestTrip.current = trip;
  }, [trip]);
  const onCompare = useCallback((next: RouteComparisonData) => {
    setData(next);
    setMode('result');
    setConfirming(false);
    setError(null);
    trackEvent({
      eventType: 'result_view',
      screen: ANALYTICS_SCREENS.routeResult,
      metadata: { source: 'route_optimization' },
    });
  }, []);
  const onExit = useCallback(() => {
    if (!applyingRef.current) {
      setData(null);
      setConfirming(false);
      setError(null);
    }
  }, []);
  const onApply = useCallback(async () => {
    if (!data || !confirming || applyingRef.current) {
      return;
    }
    const day = latestTrip.current.days.find((day) => day.id === data.day.id);
    if (!day || JSON.stringify(day) !== data.fingerprint) {
      setError(
        L(
          'routeOptimization:routeOptimizationModal.tooltip.itCannotBeAppliedBecauseSchedule',
        ),
      );
      return;
    }
    applyingRef.current = true;
    setApplying(true);
    setError(null);
    try {
      trackEvent({
        eventType: 'button_click',
        screen: ANALYTICS_SCREENS.routeResult,
        target: ANALYTICS_TARGETS.optimizeApply,
      });
      if (await controller.applyOptimizedSchedule(data.day.id, data.update)) {
        onApplied(data.day.id);
        setData(null);
        setConfirming(false);
      } else {
        setError(
          L(
            'routeOptimization:routeOptimizationModal.text.failedApplyOptimizationResultsDay',
          ),
        );
      }
    } catch {
      setError(
        L(
          'routeOptimization:routeOptimizationModal.text.failedApplyOptimizationResultsDay',
        ),
      );
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  }, [controller, data, L, onApplied, confirming]);
  const day = data
    ? trip.days.find((day) => day.id === data.day.id)
    : undefined;
  const view: RouteComparisonView | null = data
    ? {
        data,
        mode,
        applying,
        confirming,
        error,
        stale: !day || JSON.stringify(day) !== data.fingerprint,
        onModeChange: setMode,
        onExit,
        onApply: () => {
          if (!applyingRef.current) {
            setConfirming(true);
          }
        },
        onConfirmApply: () => void onApply(),
        onCancelApply: () => {
          if (!applyingRef.current) {
            setConfirming(false);
          }
        },
      }
    : null;
  return { view, onCompare };
}
