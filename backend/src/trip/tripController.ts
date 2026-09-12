import { randomUUID } from 'node:crypto';
import {
  reconcileDayRouteSegments,
  tripIdSchema,
  tripInputSchema,
  tripSchema,
  type Trip,
  type TripInput,
} from '@trasolve/shared';
import type { TripRepository } from './tripRepository.js';
import { TripError, invalidTripRequest } from './errors.js';

export class TripController {
  public constructor(private readonly repository: TripRepository) {}

  public async listTrips(userId: string): Promise<Trip[]> {
    this.validateIds(userId);
    return this.repository.listByUser(userId);
  }

  public async getTrip(userId: string, tripId: string): Promise<Trip> {
    this.validateIds(userId, tripId);
    const trip = await this.repository.getById(userId, tripId);
    if (!trip)
      throw new TripError(404, 'TRIP_NOT_FOUND', '여행을 찾을 수 없습니다.');
    return trip;
  }

  public async createTrip(userId: string, input: TripInput): Promise<Trip> {
    this.validateIds(userId);
    const now = new Date().toISOString();
    const trip = this.normalize(input, {
      id: randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    });
    await this.repository.save(userId, trip);
    return trip;
  }

  public async saveTrip(
    userId: string,
    tripId: string,
    input: TripInput,
  ): Promise<Trip> {
    this.validateIds(userId, tripId);
    // Serialize the whole read/modify/write operation, including delete.
    return this.serialize(userId, tripId, async () => {
      const existing = await this.getTrip(userId, tripId);
      const updatedAt = new Date(
        Math.max(Date.now(), Date.parse(existing.updatedAt) + 1),
      ).toISOString();
      const trip = this.normalize(input, { ...existing, updatedAt }, existing);
      await this.repository.save(userId, trip);
      return trip;
    });
  }

  public async deleteTrip(userId: string, tripId: string): Promise<void> {
    this.validateIds(userId, tripId);
    await this.serialize(userId, tripId, async () => {
      await this.getTrip(userId, tripId);
      await this.repository.delete(userId, tripId);
    });
  }

  private readonly mutations = new Map<string, Promise<unknown>>();

  private normalize(
    input: TripInput,
    metadata: Pick<Trip, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    existing?: Trip,
  ): Trip {
    const parsed = tripInputSchema.safeParse(input);
    if (!parsed.success) throw invalidTripRequest();
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
      if (!existing || !id) return randomUUID();
      if (known.has(id)) return id;
      if (id.startsWith('pending-')) return randomUUID();
      throw invalidTripRequest();
    };
    const days = parsed.data.days.map((day) => {
      const placeReferences = new Map<string, string>();
      const polylineReferences = new Map<string, string>();
      const places = day.places.map((place, index) => {
        const id = canonicalId(place.id, knownPlaces);
        if (place.id) placeReferences.set(place.id, id);
        return { ...place, id, order: index + 1 };
      });
      const polylines = day.polylines.map((polyline, index) => {
        const fromPlaceId = placeReferences.get(polyline.fromPlaceId);
        const toPlaceId = placeReferences.get(polyline.toPlaceId);
        if (!fromPlaceId || !toPlaceId) throw invalidTripRequest();
        const id = canonicalId(polyline.id, knownPolylines);
        if (polyline.id) polylineReferences.set(polyline.id, id);
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
        if (!id) throw invalidTripRequest();
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
    if (!result.success) throw invalidTripRequest();
    return result.data;
  }

  private validateIds(...ids: string[]): void {
    if (ids.some((id) => !tripIdSchema.safeParse(id).success))
      throw invalidTripRequest();
  }

  private async serialize<T>(
    userId: string,
    tripId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const key = `${userId}/${tripId}`;
    const current = (this.mutations.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(operation);
    this.mutations.set(key, current);
    try {
      return await current;
    } finally {
      if (this.mutations.get(key) === current) this.mutations.delete(key);
    }
  }
}
