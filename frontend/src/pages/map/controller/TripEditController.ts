import {
  reconcileDayRouteSegments,
  tripSchema,
  type PlaceStyle,
  type Trip,
  type TripInput,
  type TripPlace,
  type TripPolyline,
  type TripPolylineMode,
} from '@trasolve/shared';
import {
  DEFAULT_PLACE_DURATION_MINUTES,
  DEFAULT_PLACE_START_TIME,
} from '../domain/placeDefaults';
import type { TripRepository } from '../repository/TripRepository';
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
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return Promise.resolve(false);
    }

    return this.mutate((trip) => ({ ...trip, title: normalizedTitle }));
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
          polylines: [],
          layerItems: [],
        },
      ],
    }));
  }

  public renameDay(dayId: string, title: string): Promise<boolean> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return Promise.resolve(false);
    }

    return this.mutate((trip) => {
      const day = trip.days.find((day) => day.id === dayId);
      if (!day) {
        throw new Error('이름을 변경할 날짜를 찾을 수 없습니다.');
      }
      day.title = normalizedTitle;
      return trip;
    });
  }

  public updateDayColor(dayId: string, color: string): Promise<boolean> {
    return this.mutate((trip) => {
      const day = trip.days.find((candidate) => candidate.id === dayId);
      if (!day) {
        throw new Error('색상을 변경할 날짜를 찾을 수 없습니다.');
      }
      day.color = color;
      return trip;
    });
  }

  public addPlace(dayId: string, input: PlaceInput): Promise<boolean> {
    return this.mutate((trip) => {
      const day = trip.days.find((day) => day.id === dayId);
      if (!day) {
        throw new Error('장소를 추가할 날짜를 선택해 주세요.');
      }
      day.places.push({
        ...input,
        time: input.time ?? DEFAULT_PLACE_START_TIME,
        durationMinutes:
          input.durationMinutes ?? DEFAULT_PLACE_DURATION_MINUTES,
        id: `pending-${crypto.randomUUID()}`,
        order: day.places.length + 1,
      });
      day.layerItems.push({
        type: 'place',
        id: day.places.at(-1)!.id,
      });
      return trip;
    });
  }

  public removePlace(placeId: string): Promise<boolean> {
    return this.removePlaces([placeId]);
  }

  public removePlaces(placeIds: readonly string[]): Promise<boolean> {
    const uniquePlaceIds = new Set(placeIds);
    if (uniquePlaceIds.size === 0) {
      return Promise.resolve(false);
    }
    return this.mutate((trip) => {
      for (const placeId of uniquePlaceIds) {
        this.findPlace(trip, placeId);
      }
      for (const day of trip.days) {
        day.places = day.places.filter(
          (place) => !uniquePlaceIds.has(place.id),
        );
      }
      return trip;
    });
  }

  /** targetIndex is zero-based, matching the sidebar drag/drop contract. */
  public moveDay(dayId: string, targetIndex: number): Promise<boolean> {
    return this.mutate((trip) => {
      const sourceIndex = trip.days.findIndex((day) => day.id === dayId);
      if (sourceIndex < 0 || !Number.isInteger(targetIndex)) {
        throw new Error('이동할 날짜와 순서를 확인해 주세요.');
      }

      const [day] = trip.days.splice(sourceIndex, 1);
      trip.days.splice(
        Math.max(0, Math.min(targetIndex, trip.days.length)),
        0,
        day,
      );
      return trip;
    });
  }

  /** targetIndex is zero-based in the target Day's Place order. */
  public movePlace(
    placeId: string,
    targetDayId: string,
    targetIndex: number,
  ): Promise<boolean> {
    return this.mutate((trip) => {
      const target = trip.days.find((day) => day.id === targetDayId);
      if (!target || !Number.isInteger(targetIndex)) {
        throw new Error('이동할 날짜와 순서를 확인해 주세요.');
      }
      const source = trip.days.find((day) =>
        day.places.some((place) => place.id === placeId),
      );
      if (!source) {
        throw new Error('이동할 장소를 찾을 수 없습니다.');
      }
      const sourceIndex = source.places.findIndex(
        (place) => place.id === placeId,
      );
      const [place] = source.places.splice(sourceIndex, 1);
      const insertionIndex = Math.max(
        0,
        Math.min(targetIndex, target.places.length),
      );
      target.places.splice(insertionIndex, 0, place);
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

  public updateTimeRange(
    placeId: string,
    time: string,
    durationMinutes: number,
  ): Promise<boolean> {
    return this.updatePlace(placeId, { time, durationMinutes });
  }

  public updatePlaceStyle(
    placeId: string,
    placeStyle: PlaceStyle,
  ): Promise<boolean> {
    return this.updatePlace(placeId, { placeStyle });
  }

  public updatePolylineMode(
    polylineId: string,
    mode: TripPolylineMode,
  ): Promise<boolean> {
    return this.updatePolylineModes([polylineId], mode);
  }

  public updatePolylineModes(
    polylineIds: readonly string[],
    mode: TripPolylineMode,
  ): Promise<boolean> {
    const uniquePolylineIds = new Set(polylineIds);
    if (uniquePolylineIds.size === 0) {
      return Promise.resolve(false);
    }
    return this.mutate((trip) => {
      for (const polylineId of uniquePolylineIds) {
        this.findPolyline(trip, polylineId).mode = mode;
      }
      return trip;
    });
  }

  public cancelPending(): void {
    const pending = this.pending;
    if (!pending) {
      return;
    }
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
    if (!place) {
      throw new Error('장소를 찾을 수 없습니다.');
    }
    return place;
  }

  private findPolyline(trip: Trip, polylineId: string): TripPolyline {
    const polyline = trip.days
      .flatMap((day) => day.polylines)
      .find((item) => item.id === polylineId);
    if (!polyline) {
      throw new Error('연결선을 찾을 수 없습니다.');
    }
    return polyline;
  }

  private async mutate(update: (trip: Trip) => Trip): Promise<boolean> {
    const before = this.store.getState().trip;
    if (this.pending) {
      return false;
    }
    let next: Trip;
    try {
      next = update(structuredClone(before));
      for (const day of next.days) {
        reconcileDayRouteSegments(day, () => `pending-${crypto.randomUUID()}`);
      }
      next = tripSchema.parse(next);
    } catch {
      this.store.setState({
        ...this.store.getState(),
        status: 'error',
        error: '여행 변경 값이 올바르지 않습니다.',
      });
      return false;
    }
    const input: TripInput = {
      title: next.title,
      startDate: next.startDate,
      endDate: next.endDate,
      days: next.days.map((day) => ({
        ...day,
        places: day.places.map((place) => ({ ...place })),
        polylines: day.polylines.map((polyline) => ({ ...polyline })),
        layerItems: day.layerItems.map((layerItem) => ({ ...layerItem })),
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
    if (this.pending) {
      return false;
    }
    const pending = {
      controller: new AbortController(),
      before: this.store.getState(),
    };
    this.pending = pending;
    this.publish(optimistic, 'saving');
    try {
      const saved = await operation(pending.controller.signal);
      if (this.pending !== pending || pending.controller.signal.aborted) {
        return false;
      }
      if (saved.id !== this.tripId) {
        throw new Error('저장된 여행이 현재 세션과 다릅니다.');
      }
      this.publish(saved, 'ready');
      return true;
    } catch (cause) {
      if (this.pending !== pending || pending.controller.signal.aborted) {
        return false;
      }
      this.store.setState({
        ...pending.before,
        status: 'error',
        error: `${cause instanceof Error ? cause.message : '여행 요청에 실패했습니다.'} 변경 전 상태로 복원했습니다.`,
      });
      return false;
    } finally {
      if (this.pending === pending) {
        this.pending = null;
      }
    }
  }

  private publish(trip: Trip, status: TripState['status']): void {
    this.store.setState({ trip, status, error: null });
  }
}
