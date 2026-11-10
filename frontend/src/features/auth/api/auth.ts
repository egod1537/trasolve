import {
  API_ROUTES,
  authMeResponseSchema,
  type AuthUser,
} from '@trasolve/shared';
import { AUTH_SESSION_EVENT } from '@/shared/api/authEvents';

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(API_ROUTES.authMe, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Current user request failed');
  }

  return authMeResponseSchema.parse(await response.json()).user;
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
