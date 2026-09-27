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
export function tripAuthenticationRequired(): TripError {
  return new TripError(401, 'AUTHENTICATION_REQUIRED', '로그인이 필요합니다.');
}
export function tripRevisionConflict(): TripError {
  return new TripError(
    412,
    'TRIP_REVISION_CONFLICT',
    '다른 변경 사항이 먼저 저장되었습니다. 여행을 다시 불러와 주세요.',
  );
}
export function tripPreconditionRequired(): TripError {
  return new TripError(
    428,
    'TRIP_PRECONDITION_REQUIRED',
    '여행을 변경하려면 If-Match revision이 필요합니다.',
  );
}
export function tripAlreadyExists(): TripError {
  return new TripError(
    409,
    'TRIP_ALREADY_EXISTS',
    '같은 ID의 여행이 이미 존재합니다.',
  );
}
export function tripStorageUnavailable(): TripError {
  return new TripError(
    503,
    'TRIP_STORAGE_UNAVAILABLE',
    '여행 데이터를 읽거나 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  );
}
