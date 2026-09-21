import { Icon } from '@blueprintjs/core';
import { Tooltip } from '@/shared/ui/Tooltip';
import type { JobBuilderValidationStatus } from '@/features/troute-testbed/job-builder/useJobBuilderValidation';

interface Props {
  status: JobBuilderValidationStatus;
  errorCount: number;
}

const STATUS_DETAILS = {
  idle: { icon: 'circle', label: '검증 대기' },
  validating: { icon: 'refresh', label: '검증 중' },
  valid: { icon: 'tick-circle', label: '요청이 유효합니다' },
  invalid: { icon: 'error', label: '수정이 필요한 항목이 있습니다' },
} as const;

export function JobBuilderValidationIndicator({ status, errorCount }: Props) {
  const details = STATUS_DETAILS[status];
  const label =
    status === 'invalid' && errorCount > 0
      ? `${details.label} (${errorCount}개)`
      : details.label;

  return (
    <Tooltip label={label}>
      <span
        className={`job-builder-validation-indicator is-${status}`}
        role="status"
        aria-label={label}
        aria-live="polite"
        tabIndex={0}
        title={label}
      >
        <Icon icon={details.icon} size={16} />
      </span>
    </Tooltip>
  );
}
