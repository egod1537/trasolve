import type { Trip } from '@trasolve/shared';

export type TripState = Readonly<{
  trip: Trip;
  status: 'ready' | 'dirty' | 'saving' | 'error';
  error: string | null;
}>;

export interface TripStore {
  getState(): TripState;
  setState(state: TripState): void;
  subscribe(listener: () => void): () => void;
}
