import type { RouteComparisonView } from '../model/routeComparison';
import { Button } from '@/shared/ui/Button';
import { useL } from '@/shared/i18n';

/** The bottom card owns every optimization action; the status card is read-only. */
export function RouteComparisonActions({
  comparison,
}: {
  comparison: RouteComparisonView;
}) {
  const L = useL();
  const live = comparison.data.live;
  if (live) {
    const terminal = live.status === 'failed' || live.status === 'cancelled';
    return (
      <div className="route-review-actions">
        {terminal ? (
          <>
            <Button onClick={live.onClose ?? comparison.onExit}>
              {L('common:action.close')}
            </Button>
            <Button
              variant="primary"
              disabled={comparison.stale || !live.onRetry}
              onClick={live.onRetry}
            >
              {L('common:action.retry')}
            </Button>
          </>
        ) : (
          <Button
            disabled={live.status === 'cancelling'}
            loading={live.status === 'cancelling'}
            onClick={live.onCancel}
          >
            {live.status === 'cancelling'
              ? L(
                  'routeOptimization:routeOptimizationProgressDialog.action.canceling',
                )
              : L('common:action.cancel')}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="route-review-actions">
      <Button disabled={comparison.applying} onClick={comparison.onExit}>
        {L('common:action.close')}
      </Button>
      <Button
        variant="primary"
        loading={comparison.applying}
        disabled={comparison.applying || comparison.stale}
        onClick={comparison.onApply}
      >
        {L('routeOptimization:routeOptimizationModal.action.applyThisResult')}
      </Button>
    </div>
  );
}
