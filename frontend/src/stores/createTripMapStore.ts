import type { TripMapState, TripMapStore } from './TripMapStore';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createTripMapStore(): TripMapStore {
  let state: TripMapState = freeze({
    tripMap: null,
    routes: [],
    status: 'idle',
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
