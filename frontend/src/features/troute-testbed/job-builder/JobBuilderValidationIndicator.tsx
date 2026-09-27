import { Icon } from '@blueprintjs/core';
import { Tooltip } from '@/shared/ui/Tooltip';
import type { JobBuilderValidationStatus } from '@/features/troute-testbed/job-builder/useJobBuilderValidation';
import { useL, L } from '@/shared/i18n';

interface Props {
  status: JobBuilderValidationStatus;
  errorCount: number;
}

const STATUS_DETAILS = {
  idle: {
    icon: 'circle',
    get label() {
      return L(
        'testbed:jobBuilderValidationIndicator.sTATUSDETAILS.label.waitingVerification',
      );
    },
  },
  validating: {
    icon: 'refresh',
    get label() {
      return L(
        'testbed:jobBuilderValidationIndicator.sTATUSDETAILS.label.verifying',
      );
    },
  },
  valid: {
    icon: 'tick-circle',
    get label() {
      return L(
        'testbed:jobBuilderValidationIndicator.sTATUSDETAILS.label.requestValid',
      );
    },
  },
  invalid: {
    icon: 'error',
    get label() {
      return L(
        'testbed:jobBuilderValidationIndicator.sTATUSDETAILS.label.thereItemsThatNeedCorrection',
      );
    },
  },
} as const;

export function JobBuilderValidationIndicator({ status, errorCount }: Props) {
  const L = useL();
  const details = STATUS_DETAILS[status];
  const label =
    status === 'invalid' && errorCount > 0
      ? L('testbed:jobBuilderValidationIndicator.text.message', {
          label: details.label,
          errorCount: errorCount,
        })
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
