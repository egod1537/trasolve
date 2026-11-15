import type { PaymentMode } from '@trasolve/shared';
import { isDebugGuestAuthenticationEnabled } from '../configuration/debugGuest.js';
import { BILLING_OPTIONS } from '../options.js';

/** The URL marker requests unlimited usage; server policy authorizes it. */
export function isTokenUsageUnlimited(
  mode: PaymentMode,
  requested: boolean,
): boolean {
  const configured =
    process.env.TRASOLVE_DEBUG_UNLIMITED_TOKENS?.trim() || 'auto';
  if (!['auto', 'true', 'false'].includes(configured)) {
    throw new Error(
      'TRASOLVE_DEBUG_UNLIMITED_TOKENS must be auto, true or false.',
    );
  }
  if (!requested || mode === 'live' || configured === 'false') {
    return false;
  }
  if (configured === 'true') {
    return true;
  }
  return (
    BILLING_OPTIONS.unlimitedTokensInDebug &&
    (mode === 'debug' || isDebugGuestAuthenticationEnabled())
  );
}
