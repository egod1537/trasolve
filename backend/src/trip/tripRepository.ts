import type { Trip } from '@trasolve/shared';

export interface TripRepository {
  listByUser(userId: string): Promise<Trip[]>;
  getById(userId: string, tripId: string): Promise<Trip | null>;
  save(userId: string, trip: Trip): Promise<void>;
  /** Missing records may be ignored by storage; the controller returns 404. */
  delete(userId: string, tripId: string): Promise<void>;
}
