import {
  tripMapSchema,
  type TripMap,
  type TripMapInput,
  type TripMapPlace,
} from '@trasolve/shared';
import type { TripMapApi } from '../api/trips';
import type { TripMapState, TripMapStore } from '../store/TripMapStore';

export type PlaceInput = Omit<TripMapPlace, 'id' | 'order'>;

export class TripMapController {
  public constructor(
    private readonly store: TripMapStore,
    private readonly api: TripMapApi,
  ) {}

  public async loadTrip(tripId: string): Promise<boolean> {
    this.cancelPending();
    return this.run('loading', (signal) => this.api.getTrip(tripId, signal));
  }

  public async createTrip(input: TripMapInput): Promise<boolean> {
    return this.run('loading', (signal) => this.api.createTrip(input, signal));
  }

  public async deleteTrip(): Promise<boolean> {
    const trip = this.store.getState().tripMap;
    if (!trip) return false;
    return this.run('saving', async (signal) => {
      await this.api.deleteTrip(trip.id, signal);
      return null;
    });
  }

  public closeTrip(): void {
    this.cancelPending();
    this.publish(null, 'idle');
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

  private pending: {
    controller: AbortController;
    before: TripMapState;
  } | null = null;

  private findPlace(trip: TripMap, placeId: string): TripMapPlace {
    const place = trip.days
      .flatMap((day) => day.places)
      .find((place) => place.id === placeId);
    if (!place) throw new Error('장소를 찾을 수 없습니다.');
    return place;
  }

  private async mutate(update: (trip: TripMap) => TripMap): Promise<boolean> {
    const before = this.store.getState().tripMap;
    if (!before || this.pending) return false;
    let next: TripMap;
    try {
      next = update(structuredClone(before));
      for (const day of next.days)
        day.places.forEach((place, index) => {
          place.order = index + 1;
        });
      next = tripMapSchema.parse(next);
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
    const input: TripMapInput = {
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
      'saving',
      (signal) => this.api.saveTrip(before.id, input, signal),
      next,
    );
  }

  private async run(
    status: 'loading' | 'saving',
    operation: (signal: AbortSignal) => Promise<TripMap | null>,
    optimistic?: TripMap,
  ): Promise<boolean> {
    if (this.pending) return false;
    const pending = {
      controller: new AbortController(),
      before: this.store.getState(),
    };
    this.pending = pending;
    this.publish(optimistic ?? pending.before.tripMap, status);
    try {
      const saved = await operation(pending.controller.signal);
      if (this.pending !== pending || pending.controller.signal.aborted)
        return false;
      this.publish(saved, saved ? 'ready' : 'idle');
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

  private publish(
    tripMap: TripMap | null,
    status: TripMapState['status'],
  ): void {
    // Visiting-order lines are regenerated here on location/order changes and rollback.
    // A future road-route cache must be invalidated here, never inside the renderer.
    const routes =
      tripMap?.days.map((day) => ({
        dayId: day.id,
        color: day.color,
        path: day.places.map((place) => ({ ...place.location })),
      })) ?? [];
    this.store.setState({ tripMap, routes, status, error: null });
  }
}
