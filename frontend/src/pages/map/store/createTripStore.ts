import { tripSchema, type Trip } from '@trasolve/shared';
import { tripToRoutes } from '../domain/tripMapping';
import type { TripState, TripStore } from './TripStore';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createTripStore(initialTrip: Trip): TripStore {
  const trip = tripSchema.parse(initialTrip);
  let state: TripState = freeze({
    trip,
    routes: tripToRoutes(trip),
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
