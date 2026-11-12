import type { RouteTokenPolicy } from '../schemas/billing.js';

/** Shared quote arithmetic; only the server supplies the policy and debits wallets. */
export function quoteRouteTokens(n: number, policy: RouteTokenPolicy): number {
  if (!Number.isSafeInteger(n) || n < 2 || n > 500) {
    throw new RangeError('Optimization requires 2 to 500 locations.');
  }
  return Math.min(
    policy.maxCost,
    Math.max(
      1,
      Math.ceil(
        policy.baseCost *
          policy.multiplier *
          2 ** ((n - policy.referencePlaces) / policy.doublingPlaces),
      ),
    ),
  );
}
