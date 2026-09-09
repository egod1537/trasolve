import { randomUUID } from 'node:crypto';
import {
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

  public async createTrip(
    userId: string,
    input: TripInput,
  ): Promise<Trip> {
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
    const canonicalId = (id: string | undefined, known: Set<string>) => {
      if (!existing || !id) return randomUUID();
      if (!known.has(id)) throw invalidTripRequest();
      return id;
    };
    const result = tripSchema.safeParse({
      ...parsed.data,
      id: metadata.id,
      userId: metadata.userId,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      days: parsed.data.days.map((day) => ({
        ...day,
        id: canonicalId(day.id, knownDays),
        places: day.places.map((place, index) => ({
          ...place,
          id: canonicalId(place.id, knownPlaces),
          order: index + 1,
        })),
      })),
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
