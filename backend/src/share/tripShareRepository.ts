import type { TripShare } from './tripShare.js';

export interface TripShareRepository {
  getByTrip(actorUserId: string, tripId: string): Promise<TripShare | null>;
  getByToken(token: string): Promise<TripShare | null>;
  enable(
    actorUserId: string,
    tripId: string,
    token: string,
    searchable: boolean,
  ): Promise<TripShare>;
  update(
    actorUserId: string,
    tripId: string,
    searchable: boolean,
  ): Promise<TripShare | null>;
  disable(actorUserId: string, tripId: string): Promise<void>;
}

export class TripShareTokenConflictError extends Error {
  public constructor() {
    super('The public Trip share token already exists.');
    this.name = 'TripShareTokenConflictError';
  }
}

export class TripShareAlreadyEnabledError extends Error {
  public constructor() {
    super('The Trip already has a public share token.');
    this.name = 'TripShareAlreadyEnabledError';
  }
}

export class TripShareStorageError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TripShareStorageError';
  }
}
