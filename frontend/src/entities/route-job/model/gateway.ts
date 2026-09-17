import type {
  ApiErrorResponse,
  TrouteJobState,
  TrouteOptimizeResponse,
} from '@trasolve/shared';

export type TrouteGatewayResult = {
  httpStatus: number;
  statusText: string;
  durationMs: number;
  requestBody: string;
  rawResponse: string;
  responseBody: unknown;
  errorResponse: ApiErrorResponse | null;
  acceptedJobId: string | null;
  optimization: TrouteOptimizeResponse | null;
  responseValidationError: string | null;
};

export type TrouteCancelGatewayResult = {
  httpStatus: number;
  statusText: string;
  durationMs: number;
  rawResponse: string;
  responseBody: unknown;
  errorResponse: ApiErrorResponse | null;
  jobState: TrouteJobState | null;
};
