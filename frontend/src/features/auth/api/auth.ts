import {
  API_ROUTES,
  authMeResponseSchema,
  type AuthUser,
} from '@trasolve/shared';
import { AUTH_SESSION_EVENT } from '@/shared/api/authEvents';
import { createRequestCoalescer } from '@/shared/api/inflightRequests';

const currentUserRequests = createRequestCoalescer<AuthUser | null>();
let sessionRevision = 0;
const invalidateSession = () => {
  sessionRevision += 1;
};
if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_SESSION_EVENT, invalidateSession);
  import.meta.hot?.dispose(() =>
    window.removeEventListener(AUTH_SESSION_EVENT, invalidateSession),
  );
}

export function fetchCurrentUser(): Promise<AuthUser | null> {
  const revision = sessionRevision;
  return currentUserRequests(String(revision), async (signal) => {
    const response = await fetch(API_ROUTES.authMe, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Current user request failed');
    }
    const user = authMeResponseSchema.parse(await response.json()).user;
    return revision === sessionRevision ? user : fetchCurrentUser();
  });
}

export async function loginAsDebugGuest(): Promise<AuthUser> {
  const response = await fetch(API_ROUTES.authLocalLogin, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Debug guest login request failed');
  }

  const user = authMeResponseSchema.parse(await response.json()).user;
  if (!user) {
    throw new Error('Debug guest login returned no user');
  }
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  return user;
}

export async function logout(): Promise<void> {
  const response = await fetch(API_ROUTES.authLogout, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Logout request failed');
  }
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
}
