export const BILLING_REFRESH_EVENT = 'trasolve:billing-refresh';

export function withBillingMode(path: string): string {
  // Billing always uses the server-configured Toss environment. URL debug
  // flags may control other developer features, but never payment providers.
  return path;
}
export function billingHeaders(): Record<string, string> {
  return {
    'X-Trasolve-Billing': '1',
    'X-Trasolve-Request-Id': crypto.randomUUID(),
  };
}
export function notifyBillingChanged(): void {
  window.dispatchEvent(new Event(BILLING_REFRESH_EVENT));
}
