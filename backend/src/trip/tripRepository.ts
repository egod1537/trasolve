import type { Trip } from '@trasolve/shared';

export interface StoredTripHandle {
  readonly trip: Trip;
  /** PostgreSQL bigint revisions stay strings across the JavaScript boundary. */
  readonly revision: string;
}

export interface TripRepository {
  list(actorUserId: string): Promise<StoredTripHandle[]>;
  get(actorUserId: string, tripId: string): Promise<StoredTripHandle | null>;
  create(actorUserId: string, trip: Trip): Promise<StoredTripHandle>;
  update(
    actorUserId: string,
    tripId: string,
    expectedRevision: string,
    trip: Trip,
  ): Promise<StoredTripHandle>;
  softDelete(
    actorUserId: string,
    tripId: string,
    expectedRevision: string,
  ): Promise<string>;
}

export class TripRevisionConflictError extends Error {
  public constructor() {
    super('The Trip revision is stale.');
    this.name = 'TripRevisionConflictError';
  }
}

export class TripAlreadyExistsError extends Error {
  public constructor() {
    super('The Trip id already exists.');
    this.name = 'TripAlreadyExistsError';
  }
}

export class TripRepositoryNotFoundError extends Error {
  public constructor() {
    super('The Trip does not exist for this actor.');
    this.name = 'TripRepositoryNotFoundError';
  }
}

export class InvalidStoredTripError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidStoredTripError';
  }
}
