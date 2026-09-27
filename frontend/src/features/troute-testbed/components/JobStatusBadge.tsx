import type { TestbedJobStatus } from '@/entities/route-job';
import { L, useL, type Localize } from '@/shared/i18n';
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
  const localize = useL();
  return (
    <StatusBadge tone={getJobStatusTone(status)} className={className}>
      {formatJobStatus(status, localize)}
    </StatusBadge>
  );
}

export function formatJobStatus(
  status: TestbedJobStatus,
  localize: Localize = L,
): string {
  const keys: Record<TestbedJobStatus, string> = {
    pending: 'common:jobs.jOBSTATUSLABELS.text.waiting',
    running: 'common:jobs.jOBSTATUSLABELS.text.running',
    completed: 'common:jobs.jOBSTATUSLABELS.text.done',
    failed: 'common:status.error',
    cancelled: 'common:jobs.jOBSTATUSLABELS.text.canceled',
  };
  return localize(keys[status]);
}

export function getJobStatusTone(status: TestbedJobStatus): StatusTone {
  return STATUS_TONES[status];
}
