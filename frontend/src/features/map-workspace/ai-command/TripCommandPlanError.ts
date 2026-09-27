import type {
  TripCommandPlanStepId,
  TripCommandPlanValidationError,
  TripCommandPlanValidationErrorCode,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';

export class TripCommandPlanError extends Error {
  public constructor(
    public readonly code: TripCommandPlanValidationErrorCode,
    message: string,
    public readonly stepId?: TripCommandPlanStepId,
  ) {
    super(message);
    this.name = 'TripCommandPlanError';
  }

  public toValidationError(): TripCommandPlanValidationError {
    return {
      code: this.code,
      message: this.message,
      ...(this.stepId ? { stepId: this.stepId } : {}),
    };
  }
}

export function normalizeTripCommandPlanError(
  cause: unknown,
  stepId?: TripCommandPlanStepId,
): TripCommandPlanValidationError {
  return cause instanceof TripCommandPlanError
    ? cause.toValidationError()
    : {
        code: 'unsafe_operation',
        message: L(
          'map:tripCommandPlanError.normalizeTripCommandPlanError.message.travelOrderPlanCannotBeSafely',
        ),
        ...(stepId ? { stepId } : {}),
      };
}
