export type TrouteClientErrorKind =
  | 'configuration'
  | 'invalid_request'
  | 'timeout'
  | 'connection_failure'
  | 'invalid_response'
  | 'upstream_http';

export class TrouteClientError extends Error {
  public constructor(
    public readonly kind: TrouteClientErrorKind,
    message: string,
    public readonly upstreamStatus?: number,
    public readonly upstreamBody?: unknown,
  ) {
    super(message);
    this.name = 'TrouteClientError';
  }
}

export class TrouteHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'TrouteHttpError';
  }
}
