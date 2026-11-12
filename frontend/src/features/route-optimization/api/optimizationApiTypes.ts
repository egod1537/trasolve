import { type TrouteErrorPayload, type TrouteJobState } from '@trasolve/shared';

export const ROUTE_OPTIMIZATION_API_CONFIG = {
  requestTimeoutMs: 120_000,
  cancelTimeoutMs: 5_000,
} as const;

export type TrouteJobEventType =
  'snapshot' | 'progress' | 'completed' | 'failed' | 'cancelled';

export type ParsedResponseBody = {
  body: unknown;
  isJson: boolean;
};

export class RouteOptimizationApiError extends Error {
  public constructor(
    message: string,
    public readonly trouteError: TrouteErrorPayload | null = null,
  ) {
    super(message);
    this.name = 'RouteOptimizationApiError';
  }
}

export type RouteOptimizationProgress = Pick<
  TrouteJobState,
  'status' | 'stage' | 'progress' | 'last_message' | 'preview'
>;

export type RouteOptimizationFailure = {
  message: string;
  trouteError: TrouteErrorPayload | null;
};
