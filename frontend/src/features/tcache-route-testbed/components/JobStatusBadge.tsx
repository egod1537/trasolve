import type { TcacheRouteJobStatus } from '@/features/tcache-route-testbed/model/types';
import { StatusBadge, type StatusTone } from '@/shared/ui/StatusBadge';
import { L } from '@/shared/i18n';

const STATUS_LABELS: Record<TcacheRouteJobStatus, string> = {
  get queued() {
    return L('testbed:jobDetail.formatStreamState.text.waiting');
  },
  get running() {
    return L('testbed:jobStatusBadge.sTATUSLABELS.text.running');
  },
  get completed() {
    return L('testbed:jobStatusBadge.sTATUSLABELS.text.done');
  },
  get failed() {
    return L('testbed:jobStatusBadge.sTATUSLABELS.text.failure');
  },
  get cancelled() {
    return L('testbed:jobStatusBadge.sTATUSLABELS.text.canceled');
  },
};

const STATUS_TONES: Record<TcacheRouteJobStatus, StatusTone> = {
  queued: 'neutral',
  running: 'accent',
  completed: 'success',
  failed: 'danger',
  cancelled: 'warning',
};

export function JobStatusBadge({ status }: { status: TcacheRouteJobStatus }) {
  return (
    <StatusBadge tone={STATUS_TONES[status]}>
      {STATUS_LABELS[status]}
    </StatusBadge>
  );
}
