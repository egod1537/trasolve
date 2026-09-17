import type { DirectionsResult } from '@trasolve/shared';

export type RouteSummaryViewModel = {
  durationMillis: number | null;
};

export function toRouteSummaryViewModel(
  result: DirectionsResult,
): RouteSummaryViewModel {
  return {
    durationMillis: result.routes.at(0)?.durationMillis ?? null,
  };
}
