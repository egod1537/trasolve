import { isDebugMode } from '@/shared/config/debugMode';

export const BILLING_REFRESH_EVENT = 'trasolve:billing-refresh';

export function withBillingMode(path: string): string {
  // URL debug mode affects token metering, never the payment provider or wallet.
  return path;
}
export function billingHeaders(): Record<string, string> {
  return {
    'X-Trasolve-Billing': '1',
    'X-Trasolve-Request-Id': crypto.randomUUID(),
    ...(isDebugMode(window.location.search)
      ? { 'X-Trasolve-Token-Debug': '1' }
      : {}),
  };
}
export function notifyBillingChanged(): void {
  window.dispatchEvent(new Event(BILLING_REFRESH_EVENT));
}
