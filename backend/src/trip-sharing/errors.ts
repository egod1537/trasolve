export class TripShareError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TripShareError';
  }
}

export function invalidTripShareRequest(): TripShareError {
  return new TripShareError(
    400,
    'INVALID_TRIP_SHARE_REQUEST',
    '공유 요청이 올바르지 않습니다.',
  );
}

export function tripShareNotFound(): TripShareError {
  return new TripShareError(
    404,
    'TRIP_SHARE_NOT_FOUND',
    '공유 여행을 찾을 수 없습니다.',
  );
}

export function tripShareTokenConflict(): TripShareError {
  return new TripShareError(
    409,
    'TRIP_SHARE_TOKEN_CONFLICT',
    '공유 링크를 생성할 수 없습니다.',
  );
}

export function tripShareAuthenticationRequired(): TripShareError {
  return new TripShareError(
    401,
    'AUTHENTICATION_REQUIRED',
    '로그인이 필요합니다.',
  );
}

export function tripShareStorageUnavailable(): TripShareError {
  return new TripShareError(
    503,
    'TRIP_SHARE_STORAGE_UNAVAILABLE',
    '공유 설정을 처리할 수 없습니다.',
  );
}
