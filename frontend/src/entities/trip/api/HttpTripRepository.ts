import type { Trip, TripInput } from '@trasolve/shared';
import * as trips from '@/shared/api/trips';
import {
  TripRevisionConflictError,
  type TripRepository,
} from '@/entities/trip/api/TripRepository';

export class HttpTripRepository implements TripRepository {
  public listTrips(signal?: AbortSignal): Promise<Trip[]> {
    return trips.listTrips(signal);
  }

  public getTrip(id: string, signal?: AbortSignal): Promise<Trip> {
    return this.serialize(
      id,
      async () => (await this.load(id, signal)).trip,
      true,
    );
  }

  public async createTrip(
    input: TripInput,
    signal?: AbortSignal,
  ): Promise<Trip> {
    const stored = await trips.createTrip(input, signal);
    this.cacheRevision(stored.trip.id, stored.revision);
    return stored.trip;
  }

  public saveTrip(
    id: string,
    input: TripInput,
    signal?: AbortSignal,
  ): Promise<Trip> {
    return this.serialize(id, async () => {
      // Resolve the revision after earlier writes for this Trip have completed.
      const revision = await this.resolveExpectedRevision(id, signal);
      try {
        const stored = await trips.saveTrip(id, revision, input, signal);
        this.cacheRevision(id, stored.revision);
        return stored.trip;
      } catch (cause) {
        if (trips.isTripRevisionConflict(cause)) {
          await this.throwConflictWithLatest(id, signal, cause);
        }
        throw cause;
      }
    });
  }

  public deleteTrip(id: string, signal?: AbortSignal): Promise<void> {
    return this.serialize(id, async () => {
      // A queued delete must use the revision returned by the preceding write.
      const revision = await this.resolveExpectedRevision(id, signal);
      try {
        const deletedRevision = await trips.deleteTrip(id, revision, signal);
        this.cacheRevision(id, deletedRevision);
      } catch (cause) {
        if (trips.isTripRevisionConflict(cause)) {
          await this.throwConflictWithLatest(id, signal, cause);
        }
        throw cause;
      }
    });
  }

  private readonly revisions = new Map<string, string>();
  private readonly writes = new Map<string, Promise<unknown>>();

  private async load(
    id: string,
    signal?: AbortSignal,
  ): Promise<trips.StoredTripHandle> {
    const stored = await trips.getTrip(id, signal);
    this.cacheRevision(id, stored.revision);
    return stored;
  }

  private resolveExpectedRevision(
    id: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const revision = this.revisions.get(id);
    return revision
      ? Promise.resolve(revision)
      : this.load(id, signal).then((stored) => stored.revision);
  }

  private cacheRevision(id: string, revision: string): void {
    const current = this.revisions.get(id);
    if (!current || compareRevisions(revision, current) >= 0) {
      this.revisions.set(id, revision);
    }
  }

  private async throwConflictWithLatest(
    id: string,
    signal: AbortSignal | undefined,
    conflict: unknown,
  ): Promise<never> {
    let latest: trips.StoredTripHandle;
    try {
      latest = await this.load(id, signal);
    } catch {
      throw conflict;
    }
    throw new TripRevisionConflictError(latest.trip);
  }

  private async serialize<Result>(
    id: string,
    operation: () => Promise<Result>,
    recoverPreviousFailure = false,
  ): Promise<Result> {
    const previous = this.writes.get(id) ?? Promise.resolve();
    // A queued write must not proceed after an uncertain or conflicting write.
    // Reads can still recover the canonical state after that failure.
    const current = (
      recoverPreviousFailure ? previous.catch(() => undefined) : previous
    ).then(operation);
    this.writes.set(id, current);
    try {
      return await current;
    } finally {
      if (this.writes.get(id) === current) {
        this.writes.delete(id);
      }
    }
  }
}

function compareRevisions(left: string, right: string): number {
  if (left.length !== right.length) {
    return left.length - right.length;
  }
  return left === right ? 0 : left > right ? 1 : -1;
}
