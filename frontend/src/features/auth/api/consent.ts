import {
  API_ROUTES,
  authConsentStatusSchema,
  authUserSchema,
  type AuthConsentAcceptance,
  type AuthConsentStatus,
  type AuthUser,
} from '@trasolve/shared';

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
  if (!response.ok) {
    throw new Error('Consent status is unavailable.');
  }
  return authConsentStatusSchema.parse(await response.json());
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
  if (!response.ok) {
    throw new ConsentRequestError(response.status);
  }
  const result = (await response.json()) as {
    user?: unknown;
    returnTo?: unknown;
  };
  const user = authUserSchema.parse(result.user);
  // The server supplies a normalized, same-origin path, never a provider URL.
  return {
    user,
    returnTo: authConsentStatusSchema.shape.returnTo.parse(result.returnTo),
  };
}

export async function cancelConsent(): Promise<void> {
  const response = await fetch(API_ROUTES.authConsentCancel, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new ConsentRequestError(response.status);
  }
}

export class ConsentRequestError extends Error {
  public constructor(public readonly status: number) {
    super('The consent request could not be completed.');
    this.name = 'ConsentRequestError';
  }
}
