import {
  API_ROUTES,
  demoEnterResponseSchema,
  demoStatusSchema,
  type DemoStatus,
} from '@trasolve/shared';
import { AUTH_SESSION_EVENT } from '@/shared/api/authEvents';

export async function fetchDemoStatus(): Promise<DemoStatus> {
  const response = await fetch(API_ROUTES.authDemo, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Demo status request failed.');
  }
  return demoStatusSchema.parse(await response.json());
}

export async function enterDemo(
  requested: boolean,
  reset: boolean,
): Promise<ReturnType<typeof demoEnterResponseSchema.parse>> {
  const response = await fetch(API_ROUTES.authDemo, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Trasolve-Demo': '1',
    },
    body: JSON.stringify({ requested, reset }),
  });
  if (!response.ok) {
    throw new Error('Demo entry request failed.');
  }
  const result = demoEnterResponseSchema.parse(await response.json());
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  return result;
}
