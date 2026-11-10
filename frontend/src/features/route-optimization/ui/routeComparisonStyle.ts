import type { CSSProperties } from 'react';
import type { RouteComparisonMode } from '@/features/route-optimization/model/routeComparison';

export const ROUTE_COMPARISON_COLORS = {
  current: '#64748b',
  result: '#7351e8',
} as const satisfies Record<RouteComparisonMode, string>;

export function getRouteComparisonStyle(
  mode: RouteComparisonMode,
): CSSProperties {
  return {
    '--route-review-color': ROUTE_COMPARISON_COLORS[mode],
  } as CSSProperties;
}
