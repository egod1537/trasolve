import type { TripMap } from '@trasolve/shared';

export interface TripMapRepository {
  listByUser(userId: string): Promise<TripMap[]>;
  getById(userId: string, tripMapId: string): Promise<TripMap | null>;
  save(userId: string, tripMap: TripMap): Promise<void>;
  /** Missing records may be ignored by storage; the controller returns 404. */
  delete(userId: string, tripMapId: string): Promise<void>;
}
