import {
  API_ROUTES,
  authMeResponseSchema,
  type GoogleOAuthUser,
} from '@trasolve/shared';

export async function fetchCurrentUser(): Promise<GoogleOAuthUser | null> {
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

export async function logout(): Promise<void> {
  const response = await fetch(API_ROUTES.authLogout, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Logout request failed');
  }
}
