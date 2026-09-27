import type { Trip, TripInput } from '@trasolve/shared';

export class TripRevisionConflictError extends Error {
  public constructor(public readonly latestTrip: Trip) {
    super(
      '다른 곳에서 저장된 최신 여행을 불러왔습니다. 변경 내용을 확인한 뒤 다시 시도해 주세요.',
    );
    this.name = 'TripRevisionConflictError';
  }
}

/** Frontend persistence contract; the backend owns the file/DB implementation. */
export interface TripRepository {
  listTrips(signal?: AbortSignal): Promise<Trip[]>;
  getTrip(id: string, signal?: AbortSignal): Promise<Trip>;
  createTrip(input: TripInput, signal?: AbortSignal): Promise<Trip>;
  saveTrip(id: string, input: TripInput, signal?: AbortSignal): Promise<Trip>;
  deleteTrip(id: string, signal?: AbortSignal): Promise<void>;
}
