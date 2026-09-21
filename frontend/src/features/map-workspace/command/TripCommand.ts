import type { Trip } from '@trasolve/shared';

/** A synchronous, persistence-free transformation of an isolated Trip draft. */
export interface TripCommand {
  apply(trip: Trip): Trip;
}

export function defineTripCommand(apply: (trip: Trip) => Trip): TripCommand {
  return { apply };
}
