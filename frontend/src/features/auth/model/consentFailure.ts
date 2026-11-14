import { ConsentRequestError } from '../api/consent';
export type ConsentFailure = {
  kind:
    | 'network'
    | 'expired'
    | 'version'
    | 'origin'
    | 'service'
    | 'busy'
    | 'conflict'
    | 'http'
    | 'protocol';
  status: number | null;
};
export function classifyConsentFailure(cause: unknown): ConsentFailure {
  if (!(cause instanceof ConsentRequestError)) {
    return { kind: 'network', status: null };
  }
  const kind =
    cause.code === 'INVALID_CONSENT_RESPONSE'
      ? 'protocol'
      : cause.status === 401 && cause.code === 'CONSENT_SESSION_EXPIRED'
        ? 'expired'
        : cause.status === 409 && cause.code === 'LEGAL_VERSION_CHANGED'
          ? 'version'
          : cause.status === 403 && cause.code === 'INVALID_ORIGIN'
            ? 'origin'
            : cause.status === 503 && cause.code === 'CONSENT_UNAVAILABLE'
              ? 'service'
              : [409, 429].includes(cause.status) &&
                  cause.code === 'CONSENT_IN_PROGRESS'
                ? 'busy'
                : cause.status === 409 && cause.code === 'CONSENT_RETRY_CHANGED'
                  ? 'conflict'
                  : 'http';
  return { kind, status: cause.status };
}
