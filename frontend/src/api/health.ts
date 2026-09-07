import { API_ROUTES, healthResponseSchema } from '@trasolve/shared';

export async function checkApiHealth(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(API_ROUTES.health, { signal });

  if (!response.ok) {
    return false;
  }

  return healthResponseSchema.safeParse(await response.json()).success;
}
