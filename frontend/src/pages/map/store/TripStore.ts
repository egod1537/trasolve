import type { Trip } from '@trasolve/shared';
import type { TripRoute } from '../domain/trip';

export type TripState = Readonly<{
  trip: Trip;
  /** Current visiting-order geometry, not a computed road route. */
  routes: readonly TripRoute[];
  status: 'ready' | 'saving' | 'error';
  error: string | null;
}>;

export interface TripStore {
  getState(): TripState;
  setState(state: TripState): void;
  subscribe(listener: () => void): () => void;
}
