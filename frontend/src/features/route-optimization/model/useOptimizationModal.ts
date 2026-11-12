import { useEffect, useRef, useState } from 'react';
import {
  ANALYTICS_SCREENS,
  quoteRouteTokens,
  type TripDay,
} from '@trasolve/shared';
import { useBilling } from '@/features/billing';
import { useScreenView } from '@/shared/analytics';
import type { RouteOptimizationFailure } from '../api/optimizationApiTypes';
import type { Props } from './optimizationModalTypes';
import { createDayOptimizationSettings } from './optimizationDefaults';
import {
  createRouteOptimizationRequest,
  getRouteOptimizationIssue,
  type RouteOptimizationRequestOptions,
} from './routeOptimization';
import { getCachedOptimization, getOptimizationCacheKey } from './resultCache';
import { useOptimizationRun } from './useOptimizationRun';
import { useRouteValidation } from './useRouteValidation';

export function useOptimizationModal(
  { days, initialDayId, onCompare }: Props,
  formatFailure: (cause: unknown) => RouteOptimizationFailure,
) {
  const billing = useBilling();
  useScreenView(ANALYTICS_SCREENS.routeOptimization);
  const retryRef = useRef<(() => Promise<void>) | null>(null);
  const session = useOptimizationRun(onCompare, formatFailure);
  const [dayId, setDayId] = useState(initialDayId ?? days[0]?.id ?? '');
  const [settingsByDay, setSettingsByDay] = useState<
    Record<string, RouteOptimizationRequestOptions>
  >(() =>
    Object.fromEntries(
      days.map((day) => [day.id, createDayOptimizationSettings(day)]),
    ),
  );
  const day = days.find((item) => item.id === dayId) ?? days[0];
  const settings = day
    ? (settingsByDay[day.id] ?? createDayOptimizationSettings(day))
    : null;
  const issue =
    day && settings ? getRouteOptimizationIssue(day, settings) : null;
  const validation = useRouteValidation(day, settings, session.phase !== null);
  const cached = Boolean(
    day && settings && !issue && hasCachedOptimization(day, settings),
  );
  const cost =
    day && day.places.length >= 2 && billing.summary?.routeTokenPolicy
      ? quoteRouteTokens(day.places.length, billing.summary.routeTokenPolicy)
      : (billing.summary?.costs.optimize ?? 0);
  const canAfford =
    cached ||
    !billing.summary ||
    billing.summary.unlimited ||
    billing.summary.wallet.remaining >= cost;
  const changeSettings = (patch: Partial<RouteOptimizationRequestOptions>) => {
    if (!day || !settings || session.running) {
      return;
    }
    setSettingsByDay((current) => ({
      ...current,
      [day.id]: { ...settings, ...patch },
    }));
  };
  const run = async () => {
    if (
      !day ||
      !settings ||
      issue ||
      validation.blocksOptimization ||
      !canAfford
    ) {
      return;
    }
    await session.run(day, settings, () => void retryRef.current?.());
  };
  useEffect(() => {
    retryRef.current = run;
  });
  if (!day || !settings) {
    return null;
  }
  return {
    ...session,
    setDayId,
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

function hasCachedOptimization(
  day: TripDay,
  settings: RouteOptimizationRequestOptions,
): boolean {
  try {
    const request = createRouteOptimizationRequest(day, settings);
    return Boolean(
      getCachedOptimization(getOptimizationCacheKey(day.id, request)),
    );
  } catch {
    // Validation details are displayed by the existing issue UI.
    return false;
  }
}
