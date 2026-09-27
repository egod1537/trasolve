import type {
  TrouteCancelGatewayResult,
  TrouteGatewayResult,
} from '@/entities/route-job';
import { L, NL } from '@/shared/i18n';

export type GatewayOutcome =
  | 'accepted'
  | 'completed'
  | 'client-rejected'
  | 'server-rejected'
  | 'invalid-response';

export type CancelOutcome =
  | 'accepted'
  | 'cancelled'
  | 'conflict'
  | 'server-rejected'
  | 'rejected'
  | 'invalid-response';

export function classifyGatewayResult(
  result: TrouteGatewayResult,
): GatewayOutcome {
  if (result.httpStatus >= 400 && result.httpStatus < 500) {
    return 'client-rejected';
  }
  if (result.httpStatus >= 500) {
    return 'server-rejected';
  }
  if (result.acceptedJobId) {
    return 'accepted';
  }
  return result.optimization ? 'completed' : 'invalid-response';
}

export function classifyCancelResult(
  result: TrouteCancelGatewayResult,
): CancelOutcome {
  if (result.httpStatus === 409) {
    return 'conflict';
  }
  if (result.httpStatus >= 500) {
    return 'server-rejected';
  }
  if (result.httpStatus >= 400) {
    return 'rejected';
  }
  if (!result.jobState) {
    return 'invalid-response';
  }
  return result.jobState.status === 'cancelled' ? 'cancelled' : 'accepted';
}

export function describeGatewayError(result: TrouteGatewayResult): string {
  if (result.httpStatus >= 400) {
    return describeHttpError(
      result.httpStatus,
      result.errorResponse,
      L(
        'testbed:gatewayResultModel.describeGatewayError.text.trasolveBackendRequestFailed',
      ),
    );
  }
  if (!result.optimization && !result.acceptedJobId) {
    return L(
      'testbed:gatewayResultModel.describeGatewayError.text.responseValidationFailed',
      {
        value:
          result.responseValidationError ??
          L(
            'testbed:gatewayResultModel.describeGatewayError.text.successResponseDoesNotMatchTroute',
          ),
      },
    );
  }
  return '';
}

export function describeCancelError(result: TrouteCancelGatewayResult): string {
  if (result.httpStatus >= 400) {
    return describeHttpError(
      result.httpStatus,
      result.errorResponse,
      L(
        'testbed:gatewayResultModel.describeCancelError.text.requestForceTerminateJobFailed',
      ),
    );
  }
  if (!result.jobState) {
    return L(
      'testbed:gatewayResultModel.describeCancelError.text.jobForceTerminationResponseFormatIncorrect',
    );
  }
  return '';
}

function describeHttpError(
  httpStatus: number,
  errorResponse: TrouteGatewayResult['errorResponse'],
  fallback: string,
): string {
  return errorResponse
    ? [
        `${NL('HTTP')} ${httpStatus}`,
        errorResponse.error.code,
        errorResponse.error.message,
      ]
        .filter(Boolean)
        .join(' · ')
    : `${fallback} (${NL('HTTP')} ${httpStatus})`;
}
