import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  open,
} from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tripMapIdSchema, tripMapSchema, type TripMap } from '@trasolve/shared';
import type { TripMapRepository } from '../tripMapRepository.js';
import { invalidTripRequest, tripStorageUnavailable } from '../errors.js';

export class LocalFileTripMapRepository implements TripMapRepository {
  public constructor(options: { rootDir: string }) {
    this.rootDir = resolve(options.rootDir);
  }

  public async listByUser(userId: string): Promise<TripMap[]> {
    const directory = this.directory(userId);
    try {
      const files = await readdir(directory);
      const trips: TripMap[] = [];
      for (const file of files
        .filter((name) => name.endsWith('.json'))
        .sort()) {
        const trip = await this.getById(userId, file.slice(0, -5));
        if (trip) trips.push(trip);
      }
      return trips.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    } catch (error) {
      if (this.isMissing(error)) return [];
      throw tripStorageUnavailable();
    }
  }

  public async getById(
    userId: string,
    tripMapId: string,
  ): Promise<TripMap | null> {
    const path = this.path(userId, tripMapId);
    try {
      const trip = tripMapSchema.parse(
        JSON.parse(await readFile(path, 'utf8')),
      );
      if (trip.userId !== userId || trip.id !== tripMapId)
        throw tripStorageUnavailable();
      return trip;
    } catch (error) {
      if (this.isMissing(error)) return null;
      throw tripStorageUnavailable();
    }
  }

  public async save(userId: string, tripMap: TripMap): Promise<void> {
    const parsed = tripMapSchema.safeParse(tripMap);
    if (!parsed.success || parsed.data.userId !== userId)
      throw invalidTripRequest();
    const trip = parsed.data;
    const path = this.path(userId, trip.id);
    await this.serialize(path, async () => {
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        await mkdir(this.directory(userId), { recursive: true });
        const file = await open(temporary, 'wx', 0o600);
        try {
          await file.writeFile(`${JSON.stringify(trip, null, 2)}\n`, 'utf8');
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, path);
      } catch {
        throw tripStorageUnavailable();
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
    });
  }

  public async delete(userId: string, tripMapId: string): Promise<void> {
    const path = this.path(userId, tripMapId);
    await this.serialize(path, async () => {
      try {
        await unlink(path);
      } catch (error) {
        if (!this.isMissing(error)) throw tripStorageUnavailable();
      }
    });
  }

  private readonly rootDir: string;
  private readonly writes = new Map<string, Promise<void>>();

  private directory(userId: string): string {
    if (!tripMapIdSchema.safeParse(userId).success) throw invalidTripRequest();
    return join(this.rootDir, 'users', userId, 'trips');
  }

  private path(userId: string, tripMapId: string): string {
    if (!tripMapIdSchema.safeParse(tripMapId).success)
      throw invalidTripRequest();
    const path = resolve(this.directory(userId), `${tripMapId}.json`);
    const within = relative(this.rootDir, path);
    if (within.startsWith('..') || isAbsolute(within))
      throw invalidTripRequest();
    return path;
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
      if (this.writes.get(path) === current) this.writes.delete(path);
    }
  }

  private isMissing(error: unknown): boolean {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
  }
}
