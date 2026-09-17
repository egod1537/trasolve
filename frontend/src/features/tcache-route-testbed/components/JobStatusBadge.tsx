import type { TcacheRouteJobStatus } from '@/features/tcache-route-testbed/model/types';
import { StatusBadge, type StatusTone } from '@/shared/ui/StatusBadge';

const STATUS_LABELS: Record<TcacheRouteJobStatus, string> = {
  queued: '대기',
  running: '실행 중',
  completed: '완료',
  failed: '실패',
  cancelled: '취소됨',
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
