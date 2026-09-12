import {
  reconcileDayRouteSegments,
  tripSchema,
  type Trip,
} from '@trasolve/shared';
import type { TripState, TripStore } from './TripStore';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createTripStore(initialTrip: Trip): TripStore {
  const normalizedTrip = structuredClone(initialTrip);
  for (const day of normalizedTrip.days) {
    reconcileDayRouteSegments(day, () => `pending-${crypto.randomUUID()}`);
  }
  const trip = tripSchema.parse(normalizedTrip);
  let state: TripState = freeze({
    trip,
    status: 'ready',
    error: null,
  });
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (next) => {
      // Detached immutable snapshots: callers cannot mutate stored domain data.
      state = freeze(structuredClone(next));
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
