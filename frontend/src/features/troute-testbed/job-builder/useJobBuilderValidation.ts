import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  JobBuilderState,
  JobBuilderValidation,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { validateJobBuilderDraft } from '@/features/troute-testbed/job-builder/jobBuilderValidation';

export type JobBuilderValidationStatus =
  'idle' | 'validating' | 'valid' | 'invalid';

interface SettledValidation {
  status: JobBuilderValidationStatus;
  validation: JobBuilderValidation | null;
  lastValidatedAt: number | null;
}

export interface JobBuilderValidationResult extends SettledValidation {
  errors: string[];
  errorCount: number;
  isValid: boolean;
}

export function useJobBuilderValidation(
  draft: JobBuilderState,
  jobId: string,
  existingJobIds: ReadonlySet<string>,
): JobBuilderValidationResult {
  const validationSnapshot = useMemo(
    () => validateJobBuilderDraft(draft, jobId, existingJobIds),
    [draft, existingJobIds, jobId],
  );
  const sequence = useRef(0);
  const [settled, setSettled] = useState<SettledValidation>({
    status: 'idle',
    validation: null,
    lastValidatedAt: null,
  });

  useEffect(() => {
    const validationSequence = sequence.current + 1;
    sequence.current = validationSequence;

    const frame = requestAnimationFrame(() => {
      if (sequence.current !== validationSequence) {
        return;
      }
      setSettled({
        status: validationSnapshot.valid ? 'valid' : 'invalid',
        validation: validationSnapshot,
        lastValidatedAt: Date.now(),
      });
    });

    return () => {
      sequence.current += 1;
      cancelAnimationFrame(frame);
    };
  }, [validationSnapshot]);

  const status: JobBuilderValidationStatus =
    settled.validation === validationSnapshot ? settled.status : 'validating';
  const fieldErrorCount = settled.validation
    ? Object.values(settled.validation.locationErrors).reduce(
        (total, errors) => total + Object.keys(errors).length,
        settled.validation.startTimeError ? 1 : 0,
      )
    : 0;
  const errors = settled.validation?.messages ?? [];

  return {
    ...settled,
    status,
    errors,
    errorCount: Math.max(errors.length, fieldErrorCount),
    isValid: status === 'valid',
  };
}
