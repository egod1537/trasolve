import { randomUUID } from 'node:crypto';
import {
  reconcileDayRouteSegments,
  tripIdSchema,
  tripInputSchema,
  tripSchema,
  type Trip,
  type TripInput,
} from '@trasolve/shared';
import {
  TripAlreadyExistsError,
  TripRepositoryNotFoundError,
  TripRevisionConflictError,
  type StoredTripHandle,
  type TripRepository,
} from './tripRepository.js';
import {
  TripError,
  invalidTripRequest,
  tripAlreadyExists,
  tripRevisionConflict,
} from './errors.js';

export class TripController {
  public constructor(private readonly repository: TripRepository) {}

  public async listTrips(actorUserId: string): Promise<Trip[]> {
    this.validateIds(actorUserId);
    return (await this.repository.list(actorUserId)).map(
      (stored) => stored.trip,
    );
  }

  public async getTrip(
    actorUserId: string,
    tripId: string,
  ): Promise<StoredTripHandle> {
    this.validateIds(actorUserId, tripId);
    return this.getStoredTrip(actorUserId, tripId);
  }

  public async createTrip(
    actorUserId: string,
    input: TripInput,
  ): Promise<StoredTripHandle> {
    this.validateIds(actorUserId);
    const ownerUserId = actorUserId;
    const now = new Date().toISOString();
    const trip = this.normalize(input, {
      id: randomUUID(),
      userId: ownerUserId,
      createdAt: now,
      updatedAt: now,
    });
    try {
      return await this.repository.create(actorUserId, trip);
    } catch (cause) {
      if (cause instanceof TripAlreadyExistsError) {
        throw tripAlreadyExists();
      }
      throw cause;
    }
  }

  public async saveTrip(
    actorUserId: string,
    tripId: string,
    expectedRevision: string,
    input: TripInput,
  ): Promise<StoredTripHandle> {
    this.validateIds(actorUserId, tripId);
    // Serialize the whole read/modify/write operation, including delete.
    return this.serialize(actorUserId, tripId, async () => {
      const stored = await this.getStoredTrip(actorUserId, tripId);
      if (stored.revision !== expectedRevision) {
        throw tripRevisionConflict();
      }
      const existing = stored.trip;
      const updatedAt = new Date(
        Math.max(Date.now(), Date.parse(existing.updatedAt) + 1),
      ).toISOString();
      const trip = this.normalize(input, { ...existing, updatedAt }, existing);
      try {
        return await this.repository.update(
          actorUserId,
          tripId,
          expectedRevision,
          trip,
        );
      } catch (cause) {
        this.rethrowWriteError(cause);
      }
    });
  }

  public async deleteTrip(
    actorUserId: string,
    tripId: string,
    expectedRevision: string,
  ): Promise<string> {
    this.validateIds(actorUserId, tripId);
    return this.serialize(actorUserId, tripId, async () => {
      const stored = await this.getStoredTrip(actorUserId, tripId);
      if (stored.revision !== expectedRevision) {
        throw tripRevisionConflict();
      }
      try {
        return await this.repository.softDelete(
          actorUserId,
          tripId,
          expectedRevision,
        );
      } catch (cause) {
        this.rethrowWriteError(cause);
      }
    });
  }

  private readonly mutations = new Map<string, Promise<unknown>>();

  private async getStoredTrip(
    actorUserId: string,
    tripId: string,
  ): Promise<StoredTripHandle> {
    const stored = await this.repository.get(actorUserId, tripId);
    if (!stored) {
      throw new TripError(404, 'TRIP_NOT_FOUND', '여행을 찾을 수 없습니다.');
    }
    return stored;
  }

  private rethrowWriteError(cause: unknown): never {
    if (cause instanceof TripRevisionConflictError) {
      throw tripRevisionConflict();
    }
    if (cause instanceof TripRepositoryNotFoundError) {
      throw new TripError(404, 'TRIP_NOT_FOUND', '여행을 찾을 수 없습니다.');
    }
    throw cause;
  }

  private normalize(
    input: TripInput,
    metadata: Pick<Trip, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    existing?: Trip,
  ): Trip {
    const parsed = tripInputSchema.safeParse(input);
    if (!parsed.success) {
      throw invalidTripRequest();
    }
    const knownDays = new Set(existing?.days.map((day) => day.id));
    const knownPlaces = new Set(
      existing?.days.flatMap((day) => day.places.map((place) => place.id)),
    );
    const knownPolylines = new Set(
      existing?.days.flatMap((day) =>
        day.polylines.map((polyline) => polyline.id),
      ),
    );
    const canonicalId = (id: string | undefined, known: Set<string>) => {
      if (!existing || !id) {
        return randomUUID();
      }
      if (known.has(id)) {
        return id;
      }
      if (id.startsWith('pending-')) {
        return randomUUID();
      }
      throw invalidTripRequest();
    };
    const days = parsed.data.days.map((day) => {
      const placeReferences = new Map<string, string>();
      const polylineReferences = new Map<string, string>();
      const places = day.places.map((place, index) => {
        const id = canonicalId(place.id, knownPlaces);
        if (place.id) {
          placeReferences.set(place.id, id);
        }
        return { ...place, id, order: index + 1 };
      });
      const polylines = day.polylines.map((polyline, index) => {
        const fromPlaceId = placeReferences.get(polyline.fromPlaceId);
        const toPlaceId = placeReferences.get(polyline.toPlaceId);
        if (!fromPlaceId || !toPlaceId) {
          throw invalidTripRequest();
        }
        const id = canonicalId(polyline.id, knownPolylines);
        if (polyline.id) {
          polylineReferences.set(polyline.id, id);
        }
        return {
          ...polyline,
          id,
          fromPlaceId,
          toPlaceId,
          order: index + 1,
        };
      });
      const layerItems = day.layerItems.map((item) => {
        const id =
          item.type === 'place'
            ? placeReferences.get(item.id)
            : polylineReferences.get(item.id);
        if (!id) {
          throw invalidTripRequest();
        }
        return { type: item.type, id };
      });
      const layerItemKeys = new Set(
        layerItems.map((item) => `${item.type}:${item.id}`),
      );
      for (const place of places) {
        const key = `place:${place.id}`;
        if (!layerItemKeys.has(key)) {
          layerItems.push({ type: 'place', id: place.id });
          layerItemKeys.add(key);
        }
      }
      for (const polyline of polylines) {
        const key = `polyline:${polyline.id}`;
        if (!layerItemKeys.has(key)) {
          layerItems.push({ type: 'polyline', id: polyline.id });
          layerItemKeys.add(key);
        }
      }
      const layerRanks = new Map(
        layerItems.map(
          (item, index) => [`${item.type}:${item.id}`, index] as const,
        ),
      );
      places.sort(
        (left, right) =>
          (layerRanks.get(`place:${left.id}`) ?? Number.MAX_SAFE_INTEGER) -
          (layerRanks.get(`place:${right.id}`) ?? Number.MAX_SAFE_INTEGER),
      );
      places.forEach((place, index) => {
        place.order = index + 1;
      });
      polylines.sort(
        (left, right) =>
          (layerRanks.get(`polyline:${left.id}`) ?? Number.MAX_SAFE_INTEGER) -
          (layerRanks.get(`polyline:${right.id}`) ?? Number.MAX_SAFE_INTEGER),
      );
      polylines.forEach((polyline, index) => {
        polyline.order = index + 1;
      });
      const normalizedDay = {
        ...day,
        id: canonicalId(day.id, knownDays),
        places,
        polylines,
        layerItems,
      };
      reconcileDayRouteSegments(normalizedDay, randomUUID);
      return normalizedDay;
    });
    const result = tripSchema.safeParse({
      ...parsed.data,
      id: metadata.id,
      userId: metadata.userId,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      days,
    });
    if (!result.success) {
      throw invalidTripRequest();
    }
    return result.data;
  }

  private validateIds(...ids: string[]): void {
    if (ids.some((id) => !tripIdSchema.safeParse(id).success)) {
      throw invalidTripRequest();
    }
  }

  private async serialize<T>(
    actorUserId: string,
    tripId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const key = `${actorUserId}/${tripId}`;
    const current = (this.mutations.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(operation);
    this.mutations.set(key, current);
    try {
      return await current;
    } finally {
      if (this.mutations.get(key) === current) {
        this.mutations.delete(key);
      }
    }
  }
}
