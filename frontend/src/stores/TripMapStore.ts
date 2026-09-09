import type { TripMap } from '@trasolve/shared';
import type { TripRoute } from '../types/trip';

export type TripMapState = Readonly<{
  tripMap: TripMap | null;
  /** Current visiting-order geometry, not a computed road route. */
  routes: readonly TripRoute[];
  status: 'idle' | 'loading' | 'ready' | 'saving' | 'error';
  error: string | null;
}>;

export interface TripMapStore {
  getState(): TripMapState;
  setState(state: TripMapState): void;
  subscribe(listener: () => void): () => void;
}
