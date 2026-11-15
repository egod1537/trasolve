import { FAST_ROUTE_VALIDATION_MAX_LOCATIONS } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import type { RouteValidationState } from '../model/useRouteValidation';

export function RouteFeasibilitySummary({
  validation,
}: {
  validation: RouteValidationState;
}) {
  const L = useL();
  if (validation.unsupported) {
    return (
      <p className="route-settings-validation-status" role="status">
        {L('routeOptimization:fastValidation.unsupported', {
          maximum: FAST_ROUTE_VALIDATION_MAX_LOCATIONS,
          count: validation.locationCount,
        })}
      </p>
    );
  }
  if (validation.result?.feasibility?.status !== 'FEASIBLE') {
    return null;
  }
  return (
    <p className="route-settings-validation-status" role="status">
      {L('routeOptimization:fastValidation.feasible')}
    </p>
  );
}
