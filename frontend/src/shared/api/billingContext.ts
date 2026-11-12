import { isDebugMode } from '@/shared/config/debugMode';

export const BILLING_REFRESH_EVENT = 'trasolve:billing-refresh';
export const DEBUG_TOKEN_MODE_KEY = 'trasolve:debug-unlimited-tokens';
let debugUnlimited = true;

export function isDebugTokenUnlimited(): boolean {
  try {
    const stored = window.localStorage.getItem(DEBUG_TOKEN_MODE_KEY);
    if (stored === '0' || stored === '1') {
      debugUnlimited = stored === '1';
    }
  } catch {
    // A blocked preference store does not disable the in-memory switch.
  }
  return debugUnlimited;
}

export function setDebugTokenUnlimited(enabled: boolean): void {
  debugUnlimited = enabled;
  try {
    window.localStorage.setItem(DEBUG_TOKEN_MODE_KEY, enabled ? '1' : '0');
  } catch {
    // Keep the preference for this page when persistent storage is unavailable.
  }
}

export function withBillingMode(path: string): string {
  if (!isDebugMode(window.location.search)) {
    return path;
  }
  const url = new URL(path, window.location.origin);
  url.searchParams.set('debug', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}
export function billingHeaders(): Record<string, string> {
  return {
    'X-Trasolve-Billing': '1',
    'X-Trasolve-Request-Id': crypto.randomUUID(),
    ...(isDebugMode(window.location.search)
      ? { 'X-Trasolve-Token-Debug': isDebugTokenUnlimited() ? '1' : '0' }
      : {}),
  };
}
export function notifyBillingChanged(): void {
  window.dispatchEvent(new Event(BILLING_REFRESH_EVENT));
}
