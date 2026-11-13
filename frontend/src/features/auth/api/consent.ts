import {
  API_ROUTES,
  authConsentStatusSchema,
  authUserSchema,
  type AuthConsentAcceptance,
  type AuthConsentStatus,
  type AuthUser,
} from '@trasolve/shared';

const errorCodes = new Set([
  'INVALID_ORIGIN',
  'CONSENT_SESSION_EXPIRED',
  'LEGAL_VERSION_CHANGED',
  'CONSENT_UNAVAILABLE',
  'INVALID_CONSENT',
  'CONSENT_IN_PROGRESS',
  'CONSENT_RETRY_CHANGED',
  'METHOD_NOT_ALLOWED',
]);

/** Retain safe diagnostics, never the response text or arbitrary backend message. */
export class ConsentRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string | null = null,
    public readonly requestId: string | null = null,
  ) {
    super('The consent request could not be completed.');
    this.name = 'ConsentRequestError';
  }
}
async function responseBody(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const raw =
      body && typeof body === 'object' && 'error' in body ? body.error : null;
    const code =
      raw &&
      typeof raw === 'object' &&
      'code' in raw &&
      typeof raw.code === 'string' &&
      errorCodes.has(raw.code)
        ? raw.code
        : null;
    const id = response.headers.get('X-Request-ID');
    throw new ConsentRequestError(
      response.status,
      code,
      id && /^[a-f0-9-]{36}$/i.test(id) ? id : null,
    );
  }
  return body;
}
export async function fetchConsentStatus(
  signal?: AbortSignal,
): Promise<AuthConsentStatus> {
  const url = new URL(API_ROUTES.authConsent, window.location.origin);
  const destination = new URLSearchParams(window.location.search).get(
    'returnTo',
  );
  if (destination) {
    url.searchParams.set('returnTo', destination);
  }
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    headers: { Accept: 'application/json' },
  });
  const parsed = authConsentStatusSchema.safeParse(
    await responseBody(response),
  );
  if (!parsed.success) {
    throw new ConsentRequestError(response.status, 'INVALID_CONSENT_RESPONSE');
  }
  return parsed.data;
}
export async function acceptConsent(
  acceptance: AuthConsentAcceptance,
  returnTo: string,
): Promise<{ user: AuthUser; returnTo: string }> {
  const response = await fetch(API_ROUTES.authConsent, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...acceptance, returnTo }),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await responseBody(response);
  const result = raw && typeof raw === 'object' ? raw : {};
  const user = authUserSchema.safeParse(
    'user' in result ? result.user : undefined,
  );
  const path = authConsentStatusSchema.shape.returnTo.safeParse(
    'returnTo' in result ? result.returnTo : undefined,
  );
  if (!user.success || !path.success) {
    throw new ConsentRequestError(response.status, 'INVALID_CONSENT_RESPONSE');
  }
  return { user: user.data, returnTo: path.data };
}
export async function cancelConsent(): Promise<void> {
  const response = await fetch(API_ROUTES.authConsentCancel, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(5000),
  });
  await responseBody(response);
}
