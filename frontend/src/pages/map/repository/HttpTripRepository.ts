import type { Trip, TripInput } from '@trasolve/shared';
import * as trips from '../api/trips';
import type { TripRepository } from './TripRepository';

export class HttpTripRepository implements TripRepository {
  public listTrips(signal?: AbortSignal): Promise<Trip[]> {
    return trips.listTrips(signal);
  }

  public getTrip(id: string, signal?: AbortSignal): Promise<Trip> {
    return trips.getTrip(id, signal);
  }

  public createTrip(input: TripInput, signal?: AbortSignal): Promise<Trip> {
    return trips.createTrip(input, signal);
  }

  public saveTrip(
    id: string,
    input: TripInput,
    signal?: AbortSignal,
  ): Promise<Trip> {
    return trips.saveTrip(id, input, signal);
  }

  public deleteTrip(id: string, signal?: AbortSignal): Promise<void> {
    return trips.deleteTrip(id, signal);
  }
}
