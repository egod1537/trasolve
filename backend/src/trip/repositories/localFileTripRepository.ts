import { randomUUID } from 'node:crypto';
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { tripIdSchema, tripSchema, type Trip } from '@trasolve/shared';
import {
  InvalidStoredTripError,
  TripAlreadyExistsError,
  TripRepositoryNotFoundError,
  TripRevisionConflictError,
  type StoredTripHandle,
  type TripRepository,
} from '../tripRepository.js';

/** Development/rollback repository. Production runtime uses PostgreSQL. */
export class LocalFileTripRepository implements TripRepository {
  public constructor(options: { rootDir: string }) {
    this.rootDir = resolve(options.rootDir);
  }

  public async list(actorUserId: string): Promise<StoredTripHandle[]> {
    const directory = this.ownerDirectory(actorUserId);
    try {
      const files = await readdir(directory);
      const trips: StoredTripHandle[] = [];
      for (const file of files
        .filter((name) => name.endsWith('.json'))
        .sort()) {
        const stored = await this.get(actorUserId, file.slice(0, -5));
        if (stored) {
          trips.push(stored);
        }
      }
      return trips.sort((left, right) =>
        right.trip.updatedAt.localeCompare(left.trip.updatedAt),
      );
    } catch (cause) {
      if (this.isMissing(cause)) {
        return [];
      }
      throw cause;
    }
  }

  public async get(
    actorUserId: string,
    tripId: string,
  ): Promise<StoredTripHandle | null> {
    const trip = await this.readTrip(this.path(actorUserId, tripId), {
      actorUserId,
      tripId,
    });
    return trip ? this.toHandle(trip) : null;
  }

  public async create(
    actorUserId: string,
    input: Trip,
  ): Promise<StoredTripHandle> {
    const trip = this.parseOwnedTrip(actorUserId, input);
    const path = this.path(actorUserId, trip.id);
    await this.serialize(path, async () => {
      if (await this.readTrip(path, { actorUserId, tripId: trip.id })) {
        throw new TripAlreadyExistsError();
      }
      await this.writeTrip(actorUserId, path, trip);
    });
    return this.toHandle(trip);
  }

  public async update(
    actorUserId: string,
    tripId: string,
    expectedRevision: string,
    input: Trip,
  ): Promise<StoredTripHandle> {
    const trip = this.parseOwnedTrip(actorUserId, input);
    if (trip.id !== tripId) {
      throw new InvalidStoredTripError('Trip id cannot change during update.');
    }
    const path = this.path(actorUserId, tripId);
    await this.serialize(path, async () => {
      const existing = await this.readTrip(path, { actorUserId, tripId });
      if (!existing) {
        throw new TripRepositoryNotFoundError();
      }
      if (this.revisionOf(existing) !== expectedRevision) {
        throw new TripRevisionConflictError();
      }
      await this.writeTrip(actorUserId, path, trip);
    });
    return this.toHandle(trip);
  }

  public async softDelete(
    actorUserId: string,
    tripId: string,
    expectedRevision: string,
  ): Promise<string> {
    const path = this.path(actorUserId, tripId);
    await this.serialize(path, async () => {
      const existing = await this.readTrip(path, { actorUserId, tripId });
      if (!existing) {
        throw new TripRepositoryNotFoundError();
      }
      if (this.revisionOf(existing) !== expectedRevision) {
        throw new TripRevisionConflictError();
      }
      await unlink(path);
    });
    return expectedRevision;
  }

  private readonly rootDir: string;
  private readonly writes = new Map<string, Promise<void>>();

  private ownerDirectory(ownerUserId: string): string {
    if (!tripIdSchema.safeParse(ownerUserId).success) {
      throw new InvalidStoredTripError('Trip owner id is invalid.');
    }
    return join(this.rootDir, 'users', ownerUserId, 'trips');
  }

  private path(ownerUserId: string, tripId: string): string {
    if (!tripIdSchema.safeParse(tripId).success) {
      throw new InvalidStoredTripError('Trip id is invalid.');
    }
    const path = resolve(this.ownerDirectory(ownerUserId), `${tripId}.json`);
    const within = relative(this.rootDir, path);
    if (within.startsWith('..') || isAbsolute(within)) {
      throw new InvalidStoredTripError('Trip path escaped the data root.');
    }
    return path;
  }

  private async readTrip(
    path: string,
    expected: { actorUserId: string; tripId: string },
  ): Promise<Trip | null> {
    try {
      const trip = tripSchema.parse(JSON.parse(await readFile(path, 'utf8')));
      if (trip.userId !== expected.actorUserId || trip.id !== expected.tripId) {
        throw new InvalidStoredTripError('Stored Trip ownership is invalid.');
      }
      return trip;
    } catch (cause) {
      if (this.isMissing(cause)) {
        return null;
      }
      if (cause instanceof InvalidStoredTripError) {
        throw cause;
      }
      throw new InvalidStoredTripError('Stored Trip file is invalid.', {
        cause,
      });
    }
  }

  private parseOwnedTrip(actorUserId: string, input: Trip): Trip {
    try {
      const trip = tripSchema.parse(input);
      if (trip.userId !== actorUserId) {
        throw new InvalidStoredTripError('Trip owner does not match actor.');
      }
      return trip;
    } catch (cause) {
      if (cause instanceof InvalidStoredTripError) {
        throw cause;
      }
      throw new InvalidStoredTripError('Trip is invalid for persistence.', {
        cause,
      });
    }
  }

  private async writeTrip(
    actorUserId: string,
    path: string,
    trip: Trip,
  ): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await mkdir(this.ownerDirectory(actorUserId), { recursive: true });
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(`${JSON.stringify(trip, null, 2)}\n`, 'utf8');
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, path);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  private toHandle(trip: Trip): StoredTripHandle {
    return { trip, revision: this.revisionOf(trip) };
  }

  private revisionOf(trip: Trip): string {
    return String(Date.parse(trip.updatedAt));
  }

  private async serialize(
    path: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const previous = this.writes.get(path) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.writes.set(path, current);
    try {
      await current;
    } finally {
      if (this.writes.get(path) === current) {
        this.writes.delete(path);
      }
    }
  }

  private isMissing(cause: unknown): boolean {
    return cause instanceof Error && 'code' in cause && cause.code === 'ENOENT';
  }
}
