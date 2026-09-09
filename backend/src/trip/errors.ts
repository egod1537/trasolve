export class TripError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TripError';
  }
}
export function invalidTripRequest(): TripError {
  return new TripError(
    400,
    'INVALID_TRIP_REQUEST',
    '여행 요청의 형식과 값을 확인해 주세요.',
  );
}
export function tripStorageUnavailable(): TripError {
  return new TripError(
    503,
    'TRIP_STORAGE_UNAVAILABLE',
    '여행 데이터를 읽거나 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  );
}
