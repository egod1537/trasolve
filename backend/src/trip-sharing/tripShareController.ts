import { randomUUID } from 'node:crypto';
import {
  sharedTripSchema,
  tripIdSchema,
  tripShareSettingsSchema,
  tripShareTokenSchema,
  updateTripShareRequestSchema,
  type SharedTrip,
  type TripShareOwner,
  type TripShareSettings,
  type ShareViewerType,
  type UpdateTripShareRequest,
} from '@trasolve/shared';
import type { AuthRepository } from '../auth/authRepository.js';
import type { TripRepository } from '../trip/tripRepository.js';
import type { TripShare } from '../share/tripShare.js';
import {
  TripShareAlreadyEnabledError,
  TripShareTokenConflictError,
  type TripShareRepository,
} from '../share/tripShareRepository.js';
import {
  invalidTripShareRequest,
  tripShareNotFound,
  tripShareStorageUnavailable,
  tripShareTokenConflict,
} from './errors.js';
import { createShareAttributionId } from './shareAttribution.js';

const TOKEN_GENERATION_ATTEMPTS = 3;

export class TripShareController {
  public constructor(
    private readonly trips: TripRepository,
    private readonly shares: TripShareRepository,
    private readonly auth: AuthRepository,
  ) {}

  public async getSettings(
    actorUserId: string,
    tripId: string,
  ): Promise<TripShareSettings> {
    await this.requireOwnedTrip(actorUserId, tripId);
    return this.toSettings(await this.shares.getByTrip(actorUserId, tripId));
  }

  public async updateSettings(
    actorUserId: string,
    tripId: string,
    input: UpdateTripShareRequest,
  ): Promise<TripShareSettings> {
    const parsed = updateTripShareRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw invalidTripShareRequest();
    }
    return this.serialize(actorUserId, tripId, async () => {
      await this.requireOwnedTrip(actorUserId, tripId);
      const current = await this.shares.getByTrip(actorUserId, tripId);

      if (!parsed.data.enabled) {
        await this.shares.disable(actorUserId, tripId);
        return this.toSettings(null);
      }

      if (current) {
        const updated = await this.shares.update(
          actorUserId,
          tripId,
          parsed.data.searchable,
        );
        if (updated) {
          return this.toSettings(updated);
        }
      }

      let tokenCollision = false;
      for (let attempt = 0; attempt < TOKEN_GENERATION_ATTEMPTS; attempt += 1) {
        try {
          const saved = await this.shares.enable(
            actorUserId,
            tripId,
            randomUUID(),
            parsed.data.searchable,
          );
          return this.toSettings(saved);
        } catch (cause) {
          if (cause instanceof TripShareAlreadyEnabledError) {
            const updated = await this.shares.update(
              actorUserId,
              tripId,
              parsed.data.searchable,
            );
            if (updated) {
              return this.toSettings(updated);
            }
            continue;
          }
          if (cause instanceof TripShareTokenConflictError) {
            tokenCollision = true;
            continue;
          }
          throw cause;
        }
      }
      throw tokenCollision
        ? tripShareTokenConflict()
        : tripShareStorageUnavailable();
    });
  }

  public async getSharedTrip(
    token: string,
    viewerUserId?: string,
  ): Promise<SharedTrip> {
    const parsedToken = tripShareTokenSchema.safeParse(token);
    if (!parsedToken.success) {
      throw tripShareNotFound();
    }
    const share = await this.shares.getByToken(parsedToken.data);
    if (!share || share.token !== parsedToken.data) {
      throw tripShareNotFound();
    }
    const stored = await this.trips.get(share.ownerUserId, share.tripId);
    if (!stored) {
      throw tripShareNotFound();
    }
    const { userId, ...publicTrip } = stored.trip;
    if (userId !== share.ownerUserId) {
      throw tripShareNotFound();
    }
    const owner = await this.getOwner(share.ownerUserId);
    return sharedTripSchema.parse({
      trip: publicTrip,
      owner,
      attribution: {
        shareId: createShareAttributionId(share.token),
        viewerType: this.resolveViewerType(viewerUserId, share.ownerUserId),
      },
    });
  }

  private readonly mutations = new Map<string, Promise<unknown>>();

  private async requireOwnedTrip(
    actorUserId: string,
    tripId: string,
  ): Promise<void> {
    if (
      !tripIdSchema.safeParse(actorUserId).success ||
      !tripIdSchema.safeParse(tripId).success
    ) {
      throw invalidTripShareRequest();
    }
    if (!(await this.trips.get(actorUserId, tripId))) {
      throw tripShareNotFound();
    }
  }

  private async getOwner(userId: string): Promise<TripShareOwner> {
    const user = await this.auth.getUserById(userId);
    if (!user) {
      throw tripShareNotFound();
    }
    return { displayName: user.displayName, avatarUrl: user.avatarUrl };
  }

  private toSettings(record: TripShare | null): TripShareSettings {
    return tripShareSettingsSchema.parse({
      enabled: record !== null,
      searchable: record?.searchable ?? false,
      token: record?.token ?? null,
      shareId: record ? createShareAttributionId(record.token) : null,
    });
  }

  private resolveViewerType(
    viewerUserId: string | undefined,
    ownerUserId: string,
  ): ShareViewerType {
    if (viewerUserId === undefined) {
      return 'anonymous';
    }
    return viewerUserId === ownerUserId
      ? 'owner_self'
      : 'external_authenticated';
  }

  private async serialize<Result>(
    actorUserId: string,
    tripId: string,
    operation: () => Promise<Result>,
  ): Promise<Result> {
    const key = `${actorUserId}:${tripId}`;
    const pending = (this.mutations.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(operation);
    this.mutations.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.mutations.get(key) === pending) {
        this.mutations.delete(key);
      }
    }
  }
}
