import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { tripIdSchema, tripShareTokenSchema } from '@trasolve/shared';
import { z } from 'zod';
import type { TripShare } from '../share/tripShare.js';
import {
  TripShareAlreadyEnabledError,
  TripShareStorageError,
  TripShareTokenConflictError,
  type TripShareRepository,
} from '../share/tripShareRepository.js';

const localShareSchema = z.strictObject({
  tripId: tripIdSchema,
  ownerUserId: tripIdSchema,
  token: tripShareTokenSchema,
  searchable: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const localTokenIndexSchema = z.strictObject({
  tripId: tripIdSchema,
  ownerUserId: tripIdSchema,
  token: tripShareTokenSchema,
});

const shareIdentitySchema = z.strictObject({
  ownerUserId: tripIdSchema,
  tripId: tripIdSchema,
});

type LocalTokenIndex = z.infer<typeof localTokenIndexSchema>;

export class LocalFileTripShareRepository implements TripShareRepository {
  public constructor(options: { rootDir: string }) {
    const sharesRoot = resolve(options.rootDir, 'shares');
    this.byTripRoot = resolve(sharesRoot, 'by-trip');
    this.byTokenRoot = resolve(sharesRoot, 'by-token');
  }

  public async getByTrip(
    actorUserId: string,
    tripId: string,
  ): Promise<TripShare | null> {
    const identity = this.parseIdentity(actorUserId, tripId);
    await this.writeTail;
    return this.readConsistentByTrip(identity.ownerUserId, identity.tripId);
  }

  public async getByToken(token: string): Promise<TripShare | null> {
    const parsedToken = tripShareTokenSchema.parse(token);
    await this.writeTail;
    return this.readConsistentByToken(parsedToken);
  }

  public enable(
    actorUserId: string,
    tripId: string,
    token: string,
    searchable: boolean,
  ): Promise<TripShare> {
    const identity = this.parseIdentity(actorUserId, tripId);
    const parsedToken = tripShareTokenSchema.parse(token);
    return this.mutate(async () => {
      const existing = await this.readConsistentByTrip(
        identity.ownerUserId,
        identity.tripId,
      );
      if (existing) {
        throw new TripShareAlreadyEnabledError();
      }
      if (await this.readTokenIndex(parsedToken)) {
        throw new TripShareTokenConflictError();
      }

      const now = new Date().toISOString();
      const share = localShareSchema.parse({
        tripId: identity.tripId,
        ownerUserId: identity.ownerUserId,
        token: parsedToken,
        searchable,
        createdAt: now,
        updatedAt: now,
      });
      const index = this.toTokenIndex(share);
      await this.writeNewPair(
        this.tripPath(share.ownerUserId, share.tripId),
        share,
        this.tokenPath(share.token),
        index,
      );
      return share;
    });
  }

  public update(
    actorUserId: string,
    tripId: string,
    searchable: boolean,
  ): Promise<TripShare | null> {
    const identity = this.parseIdentity(actorUserId, tripId);
    return this.mutate(async () => {
      const current = await this.readConsistentByTrip(
        identity.ownerUserId,
        identity.tripId,
      );
      if (!current) {
        return null;
      }
      const updated = localShareSchema.parse({
        ...current,
        searchable,
        updatedAt: new Date().toISOString(),
      });
      await this.writeReplacement(
        this.tripPath(updated.ownerUserId, updated.tripId),
        updated,
      );
      return updated;
    });
  }

  public disable(actorUserId: string, tripId: string): Promise<void> {
    const identity = this.parseIdentity(actorUserId, tripId);
    return this.mutate(async () => {
      const current = await this.readConsistentByTrip(
        identity.ownerUserId,
        identity.tripId,
      );
      if (!current) {
        return;
      }

      const tripPath = this.tripPath(current.ownerUserId, current.tripId);
      const tokenPath = this.tokenPath(current.token);
      let tripDeleted = false;
      try {
        await unlink(tripPath);
        tripDeleted = true;
        await unlink(tokenPath);
      } catch (cause) {
        if (tripDeleted) {
          try {
            await this.writeNewFile(tripPath, current);
          } catch (rollbackCause) {
            throw new TripShareStorageError(
              'Local Trip share disable and rollback both failed.',
              { cause: new AggregateError([cause, rollbackCause]) },
            );
          }
        }
        throw new TripShareStorageError(
          'Local Trip share could not be disabled.',
          { cause },
        );
      }
    });
  }

  private readonly byTripRoot: string;
  private readonly byTokenRoot: string;
  private writeTail: Promise<void> = Promise.resolve();

  private parseIdentity(
    ownerUserId: string,
    tripId: string,
  ): { ownerUserId: string; tripId: string } {
    return shareIdentitySchema.parse({ ownerUserId, tripId });
  }

  private tripPath(ownerUserId: string, tripId: string): string {
    return this.safePath(this.byTripRoot, ownerUserId, `${tripId}.json`);
  }

  private tokenPath(token: string): string {
    return this.safePath(this.byTokenRoot, `${token}.json`);
  }

  private safePath(root: string, ...segments: string[]): string {
    const path = resolve(root, ...segments);
    const within = relative(root, path);
    if (!within || within.startsWith('..') || isAbsolute(within)) {
      throw new TripShareStorageError(
        'Local Trip share path escaped its storage root.',
      );
    }
    return path;
  }

  private async readConsistentByTrip(
    ownerUserId: string,
    tripId: string,
  ): Promise<TripShare | null> {
    const share = await this.readShare(this.tripPath(ownerUserId, tripId));
    if (!share) {
      return null;
    }
    if (share.ownerUserId !== ownerUserId || share.tripId !== tripId) {
      throw this.inconsistentStorage();
    }
    const index = await this.readTokenIndex(share.token);
    if (!index || !this.matches(share, index)) {
      throw this.inconsistentStorage();
    }
    return share;
  }

  private async readConsistentByToken(
    token: string,
  ): Promise<TripShare | null> {
    const index = await this.readTokenIndex(token);
    if (!index) {
      return null;
    }
    if (index.token !== token) {
      throw this.inconsistentStorage();
    }
    const share = await this.readShare(
      this.tripPath(index.ownerUserId, index.tripId),
    );
    if (!share || !this.matches(share, index)) {
      throw this.inconsistentStorage();
    }
    return share;
  }

  private async readShare(path: string): Promise<TripShare | null> {
    return this.readFile(path, localShareSchema, 'Trip share');
  }

  private async readTokenIndex(token: string): Promise<LocalTokenIndex | null> {
    return this.readFile(
      this.tokenPath(token),
      localTokenIndexSchema,
      'Trip share token index',
    );
  }

  private async readFile<Value>(
    path: string,
    schema: z.ZodType<Value>,
    label: string,
  ): Promise<Value | null> {
    try {
      return schema.parse(JSON.parse(await readFile(path, 'utf8')));
    } catch (cause) {
      if (this.isMissing(cause)) {
        return null;
      }
      throw new TripShareStorageError(`${label} file is invalid.`, { cause });
    }
  }

  private mutate<Result>(operation: () => Promise<Result>): Promise<Result> {
    const pending = this.writeTail.then(operation);
    this.writeTail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  private async writeNewPair(
    tripPath: string,
    share: TripShare,
    tokenPath: string,
    index: LocalTokenIndex,
  ): Promise<void> {
    let tripTemporary: string | null = null;
    let tokenTemporary: string | null = null;
    let tokenMoved = false;
    try {
      tripTemporary = await this.prepareFile(tripPath, share);
      tokenTemporary = await this.prepareFile(tokenPath, index);
      await this.requireMissing(tripPath, false);
      await this.requireMissing(tokenPath, true);
      await rename(tokenTemporary, tokenPath);
      tokenMoved = true;
      await rename(tripTemporary, tripPath);
    } catch (cause) {
      if (tokenMoved) {
        await unlink(tokenPath).catch(() => undefined);
      }
      throw cause instanceof TripShareStorageError ||
        cause instanceof TripShareTokenConflictError
        ? cause
        : new TripShareStorageError(
            'Local Trip share files could not be created.',
            { cause },
          );
    } finally {
      await Promise.all([
        tripTemporary
          ? unlink(tripTemporary).catch(() => undefined)
          : Promise.resolve(),
        tokenTemporary
          ? unlink(tokenTemporary).catch(() => undefined)
          : Promise.resolve(),
      ]);
    }
  }

  private async writeNewFile(path: string, value: unknown): Promise<void> {
    const temporary = await this.prepareFile(path, value);
    try {
      await this.requireMissing(path, false);
      await rename(temporary, path);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  private async writeReplacement(path: string, value: unknown): Promise<void> {
    const temporary = await this.prepareFile(path, value);
    try {
      await rename(temporary, path);
    } catch (cause) {
      throw new TripShareStorageError(
        'Local Trip share file could not be replaced.',
        { cause },
      );
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  private async prepareFile(path: string, value: unknown): Promise<string> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    try {
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
        await file.sync();
      } finally {
        await file.close();
      }
      return temporary;
    } catch (cause) {
      await unlink(temporary).catch(() => undefined);
      throw new TripShareStorageError(
        'Local Trip share temporary file could not be written.',
        { cause },
      );
    }
  }

  private async requireMissing(
    path: string,
    tokenCollision: boolean,
  ): Promise<void> {
    try {
      await readFile(path);
      throw tokenCollision
        ? new TripShareTokenConflictError()
        : new TripShareStorageError(
            'Local Trip share destination already exists.',
          );
    } catch (cause) {
      if (this.isMissing(cause)) {
        return;
      }
      throw cause;
    }
  }

  private toTokenIndex(share: TripShare): LocalTokenIndex {
    return localTokenIndexSchema.parse({
      tripId: share.tripId,
      ownerUserId: share.ownerUserId,
      token: share.token,
    });
  }

  private matches(share: TripShare, index: LocalTokenIndex): boolean {
    return (
      share.tripId === index.tripId &&
      share.ownerUserId === index.ownerUserId &&
      share.token === index.token
    );
  }

  private inconsistentStorage(): TripShareStorageError {
    return new TripShareStorageError(
      'Local Trip share indexes are inconsistent.',
    );
  }

  private isMissing(cause: unknown): boolean {
    return cause instanceof Error && 'code' in cause && cause.code === 'ENOENT';
  }
}
