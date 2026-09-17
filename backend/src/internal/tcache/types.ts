export type TcacheClientErrorKind =
  | 'configuration'
  | 'timeout'
  | 'unreachable'
  | 'upstream_http'
  | 'invalid_response'
  | 'aborted';

export interface TcacheUpstreamResponse {
  status: number;
  contentType: string | null;
  body: Uint8Array;
}

export class TcacheClientError extends Error {
  public constructor(
    public readonly kind: TcacheClientErrorKind,
    message: string,
    public readonly upstreamStatus?: number,
    public readonly upstreamBody?: Uint8Array,
    public readonly upstreamContentType?: string | null,
  ) {
    super(message);
    this.name = 'TcacheClientError';
  }
}

export class TcacheHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly allow?: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'TcacheHttpError';
  }
}
