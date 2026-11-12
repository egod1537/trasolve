import { z } from 'zod';
import { quoteRouteTokens, type RouteTokenPolicy } from '@trasolve/shared';

const rateSchema = z.object({
  input: z.number().finite().nonnegative(),
  output: z.number().finite().nonnegative(),
  cachedInput: z.number().finite().nonnegative(),
});
export type ModelTokenRate = z.infer<typeof rateSchema>;

/** Prices are USD per million model tokens, not service tokens. */
export class TokenPricing {
  public readonly routePolicy: RouteTokenPolicy = {
    baseCost: setting('TRASOLVE_TOKEN_OPTIMIZE_COST', 50),
    multiplier:
      setting('TRASOLVE_TOKEN_MULTIPLIER', 1) *
      setting('TRASOLVE_TOKEN_OPTIMIZE_MULTIPLIER', 1),
    referencePlaces: setting('TRASOLVE_TOKEN_ROUTE_REFERENCE_PLACES', 10),
    doublingPlaces: setting('TRASOLVE_TOKEN_ROUTE_DOUBLING_PLACES', 10),
    maxCost: setting('TRASOLVE_TOKEN_ROUTE_MAX_COST', 10_000_000, true),
  };
  public readonly chatReservation = setting(
    'TRASOLVE_TOKEN_CHAT_MAX_COST',
    1000,
    true,
  );

  public quoteRoute(n: number): number {
    return quoteRouteTokens(n, this.routePolicy);
  }

  public chatCost(calls: readonly ModelTokenUsage[]): number {
    const usd = calls.reduce((total, call) => {
      const rate = this.models[call.model] ?? this.defaultRate;
      const cached = Math.min(call.input, call.cachedInput);
      return (
        total +
        ((call.input - cached) * rate.input +
          cached * rate.cachedInput +
          call.output * rate.output) /
          1_000_000
      );
    }, 0);
    return Math.min(
      this.chatReservation,
      Math.max(
        1,
        Math.ceil((usd * this.chatMultiplier) / this.usdPerServiceToken),
      ),
    );
  }

  private readonly chatMultiplier =
    setting('TRASOLVE_TOKEN_MULTIPLIER', 1) *
    setting('TRASOLVE_TOKEN_CHAT_MULTIPLIER', 1);
  private readonly usdPerServiceToken = setting(
    'TRASOLVE_TOKEN_USD_PER_TOKEN',
    0.0001,
  );
  // Reference rates for local/unknown models. Operators set actual rates by model ID.
  private readonly defaultRate = {
    input: setting('TRASOLVE_TOKEN_AI_INPUT_USD_PER_MILLION', 1),
    output: setting('TRASOLVE_TOKEN_AI_OUTPUT_USD_PER_MILLION', 5),
    cachedInput: setting('TRASOLVE_TOKEN_AI_CACHED_INPUT_USD_PER_MILLION', 0.1),
  };
  private readonly models = z
    .record(z.string(), rateSchema)
    .parse(JSON.parse(process.env.TRASOLVE_TOKEN_MODEL_RATES?.trim() || '{}'));
}

export type ModelTokenUsage = {
  model: string;
  input: number;
  output: number;
  cachedInput: number;
  estimated: boolean;
};

function setting(name: string, fallback: number, integer = false): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 10_000_000 ||
    (integer && !Number.isSafeInteger(value))
  ) {
    throw new Error(
      `${name} must be positive, finite and at most 10000000${integer ? ' (integer)' : ''}.`,
    );
  }
  return value;
}
