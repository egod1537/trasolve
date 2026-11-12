import type { Localize } from '@/shared/i18n';
import {
  RouteOptimizationApiError,
  type RouteOptimizationFailure,
} from '../api/routeOptimizationApi';
import { RouteOptimizationValidationError } from '../model/routeOptimization';
import { InapplicableOptimizationResultError } from '../model/runRouteOptimization';
import { formatRouteOptimizationIssue } from './optimizationSettings';

export function formatOptimizationFailure(
  cause: unknown,
  L: Localize,
): RouteOptimizationFailure {
  const message =
    cause instanceof RouteOptimizationValidationError
      ? formatRouteOptimizationIssue(cause.issue, L)
      : cause instanceof InapplicableOptimizationResultError
        ? L(
            'routeOptimization:routeOptimizationModal.tooltip.itCannotBeAppliedBecauseSchedule',
          )
        : cause instanceof Error
          ? cause.message
          : L(
              'routeOptimization:routeOptimizationModal.text.routeOptimizationRequestFailed',
            );
  return {
    message,
    trouteError:
      cause instanceof RouteOptimizationApiError ? cause.trouteError : null,
  };
}
