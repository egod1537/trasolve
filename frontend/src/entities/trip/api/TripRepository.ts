import type { Trip, TripInput } from '@trasolve/shared';

/** Frontend persistence contract; the backend owns the file/DB implementation. */
export interface TripRepository {
  listTrips(signal?: AbortSignal): Promise<Trip[]>;
  getTrip(id: string, signal?: AbortSignal): Promise<Trip>;
  createTrip(input: TripInput, signal?: AbortSignal): Promise<Trip>;
  saveTrip(id: string, input: TripInput, signal?: AbortSignal): Promise<Trip>;
  deleteTrip(id: string, signal?: AbortSignal): Promise<void>;
}
