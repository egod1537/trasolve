import { Callout, Intent } from '@blueprintjs/core';
import type { ReactNode } from 'react';
import type { JobBuilderValidationStatus } from '@/features/troute-testbed/job-builder/useJobBuilderValidation';

export function JobBuilderContentFlow({
  validationStatus,
  validationErrors,
  feedback,
  children,
}: {
  validationStatus: JobBuilderValidationStatus;
  validationErrors: readonly string[];
  feedback: { intent: Intent; message: string } | null;
  children?: ReactNode;
}) {
  return (
    <>
      {validationStatus === 'invalid' && validationErrors.length > 0 ? (
        <Callout
          className="job-builder-validation-summary"
          compact
          intent={Intent.DANGER}
          role="alert"
        >
          {validationErrors.join(' ')}
        </Callout>
      ) : null}

      {feedback ? (
        <Callout
          className="job-builder-feedback"
          compact
          intent={feedback.intent}
          role={feedback.intent === Intent.DANGER ? 'alert' : 'status'}
        >
          {feedback.message}
        </Callout>
      ) : null}

      {children}
    </>
  );
}
