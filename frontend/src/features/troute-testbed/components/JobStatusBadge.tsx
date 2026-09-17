import type { TestbedJobStatus } from '@/entities/route-job';
import { JOB_STATUS_LABELS } from '@/entities/route-job';
import { StatusBadge, type StatusTone } from '@/shared/ui/StatusBadge';

const STATUS_TONES: Record<TestbedJobStatus, StatusTone> = {
  pending: 'neutral',
  running: 'accent',
  completed: 'success',
  failed: 'danger',
  cancelled: 'warning',
};

type Props = {
  status: TestbedJobStatus;
  className?: string;
};

export function JobStatusBadge({ status, className }: Props) {
  return (
    <StatusBadge tone={getJobStatusTone(status)} className={className}>
      {JOB_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function getJobStatusTone(status: TestbedJobStatus): StatusTone {
  return STATUS_TONES[status];
}
