import type {
  TrouteCancelGatewayResult,
  TrouteGatewayResult,
} from '@/entities/route-job';

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
      'Trasolve backend 요청이 실패했습니다.',
    );
  }
  if (!result.optimization && !result.acceptedJobId) {
    return `응답 검증 실패: ${result.responseValidationError ?? '성공 응답이 troute 계약과 일치하지 않습니다.'}`;
  }
  return '';
}

export function describeCancelError(result: TrouteCancelGatewayResult): string {
  if (result.httpStatus >= 400) {
    return describeHttpError(
      result.httpStatus,
      result.errorResponse,
      'Job 강제 종료 요청이 실패했습니다.',
    );
  }
  if (!result.jobState) {
    return 'Job 강제 종료 응답 형식이 올바르지 않습니다.';
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
        `HTTP ${httpStatus}`,
        errorResponse.error.code,
        errorResponse.error.message,
      ]
        .filter(Boolean)
        .join(' · ')
    : `${fallback} (HTTP ${httpStatus})`;
}
