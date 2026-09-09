import {
  tripSchema,
  type Trip,
  type TripInput,
  type TripPlace,
} from '@trasolve/shared';
import type { TripRepository } from '../repository/TripRepository';
import { tripToRoutes } from '../domain/tripMapping';
import type { TripState, TripStore } from '../store/TripStore';

export type PlaceInput = Omit<TripPlace, 'id' | 'order'>;

export class TripEditController {
  public constructor(
    private readonly store: TripStore,
    private readonly repository: TripRepository,
  ) {
    this.tripId = tripSchema.parse(store.getState().trip).id;
  }

  public save(): Promise<boolean> {
    return this.mutate((trip) => trip);
  }

  public renameTrip(title: string): Promise<boolean> {
    return this.mutate((trip) => ({ ...trip, title: title.trim() }));
  }

  public addDay(title: string): Promise<boolean> {
    return this.mutate((trip) => ({
      ...trip,
      days: [
        ...trip.days,
        {
          id: `pending-${crypto.randomUUID()}`,
          title,
          color: '#2563eb',
          places: [],
        },
      ],
    }));
  }

  public addPlace(dayId: string, input: PlaceInput): Promise<boolean> {
    return this.mutate((trip) => {
      const day = trip.days.find((day) => day.id === dayId);
      if (!day) throw new Error('장소를 추가할 날짜를 선택해 주세요.');
      day.places.push({
        ...input,
        id: `pending-${crypto.randomUUID()}`,
        order: day.places.length + 1,
      });
      return trip;
    });
  }

  public removePlace(placeId: string): Promise<boolean> {
    return this.mutate((trip) => {
      this.findPlace(trip, placeId);
      for (const day of trip.days)
        day.places = day.places.filter((place) => place.id !== placeId);
      return trip;
    });
  }

  /** targetIndex is zero-based, matching the sidebar drag/drop contract. */
  public movePlace(
    placeId: string,
    targetDayId: string,
    targetIndex: number,
  ): Promise<boolean> {
    return this.mutate((trip) => {
      const target = trip.days.find((day) => day.id === targetDayId);
      if (!target || !Number.isInteger(targetIndex))
        throw new Error('이동할 날짜와 순서를 확인해 주세요.');
      const place = this.findPlace(trip, placeId);
      for (const day of trip.days)
        day.places = day.places.filter((item) => item.id !== placeId);
      target.places.splice(
        Math.max(0, Math.min(targetIndex, target.places.length)),
        0,
        place,
      );
      return trip;
    });
  }

  public updatePlace(
    placeId: string,
    patch: Partial<PlaceInput>,
  ): Promise<boolean> {
    return this.mutate((trip) => {
      const place = this.findPlace(trip, placeId);
      Object.assign(place, patch);
      return trip;
    });
  }

  public updateMemo(placeId: string, memo: string): Promise<boolean> {
    return this.updatePlace(placeId, { memo });
  }

  public cancelPending(): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    pending.controller.abort();
    this.store.setState(pending.before);
  }

  private readonly tripId: string;

  private pending: {
    controller: AbortController;
    before: TripState;
  } | null = null;

  private findPlace(trip: Trip, placeId: string): TripPlace {
    const place = trip.days
      .flatMap((day) => day.places)
      .find((place) => place.id === placeId);
    if (!place) throw new Error('장소를 찾을 수 없습니다.');
    return place;
  }

  private async mutate(update: (trip: Trip) => Trip): Promise<boolean> {
    const before = this.store.getState().trip;
    if (this.pending) return false;
    let next: Trip;
    try {
      next = update(structuredClone(before));
      for (const day of next.days)
        day.places.forEach((place, index) => {
          place.order = index + 1;
        });
      next = tripSchema.parse(next);
    } catch {
      this.store.setState({
        ...this.store.getState(),
        status: 'error',
        error: '여행 변경 값이 올바르지 않습니다.',
      });
      return false;
    }
    const days = new Set(before.days.map((day) => day.id));
    const places = new Set(
      before.days.flatMap((day) => day.places.map((place) => place.id)),
    );
    const input: TripInput = {
      title: next.title,
      startDate: next.startDate,
      endDate: next.endDate,
      days: next.days.map((day) => ({
        ...day,
        id: days.has(day.id) ? day.id : undefined,
        places: day.places.map((place) => ({
          ...place,
          id: places.has(place.id) ? place.id : undefined,
        })),
      })),
    };
    return this.run(
      (signal) => this.repository.saveTrip(this.tripId, input, signal),
      next,
    );
  }

  private async run(
    operation: (signal: AbortSignal) => Promise<Trip>,
    optimistic: Trip,
  ): Promise<boolean> {
    if (this.pending) return false;
    const pending = {
      controller: new AbortController(),
      before: this.store.getState(),
    };
    this.pending = pending;
    this.publish(optimistic, 'saving');
    try {
      const saved = await operation(pending.controller.signal);
      if (this.pending !== pending || pending.controller.signal.aborted)
        return false;
      if (saved.id !== this.tripId)
        throw new Error('저장된 여행이 현재 세션과 다릅니다.');
      this.publish(saved, 'ready');
      return true;
    } catch (cause) {
      if (this.pending !== pending || pending.controller.signal.aborted)
        return false;
      this.store.setState({
        ...pending.before,
        status: 'error',
        error: `${cause instanceof Error ? cause.message : '여행 요청에 실패했습니다.'} 변경 전 상태로 복원했습니다.`,
      });
      return false;
    } finally {
      if (this.pending === pending) this.pending = null;
    }
  }

  private publish(trip: Trip, status: TripState['status']): void {
    // Visiting-order lines are regenerated here on location/order changes and rollback.
    // A future road-route cache must be invalidated here, never inside the renderer.
    const routes = tripToRoutes(trip);
    this.store.setState({ trip, routes, status, error: null });
  }
}
