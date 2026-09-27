import {
  API_ROUTES,
  tripIdSchema,
  tripSchema,
  tripListSchema,
  tripInputSchema,
  type Trip,
  type TripInput,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';

export type StoredTripHandle = {
  readonly trip: Trip;
  readonly revision: string;
};

export class TripApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super(
      status === 401
        ? L('auth:mapUserControls.text.signGoogleAccount')
        : L('errors:trips.error.travelRequestCannotBeProcessed'),
    );
    this.name = 'TripApiError';
  }
}

type ResponseResult = {
  readonly body: unknown;
  readonly response: Response;
};

const revisionEtagPattern = /^"([1-9]\d*)"$/;

async function request(
  path: string,
  method: string,
  input?: TripInput,
  signal?: AbortSignal,
  expectedRevision?: string,
): Promise<ResponseResult> {
  const payload =
    input === undefined ? undefined : tripInputSchema.parse(input);
  const headers: Record<string, string> = {};
  if (payload) {
    headers['Content-Type'] = 'application/json';
  }
  if (expectedRevision) {
    headers['If-Match'] = formatEtag(expectedRevision);
  }
  const timeout = AbortSignal.timeout(20000);
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (cause) {
    if (signal?.aborted) {
      throw cause;
    }
    throw new Error(
      timeout.aborted
        ? L('errors:trips.error.travelRequestTimedOutRefreshList')
        : L('errors:trips.error.unableConnectTravelServer'),
    );
  }
  if (response.ok && response.status === 204) {
    return { body: undefined, response };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new TripApiError(response.status, getErrorCode(body));
  }
  return { body, response };
}

function path(tripId: string): string {
  return `${API_ROUTES.trips}/${encodeURIComponent(tripIdSchema.parse(tripId))}`;
}

export async function listTrips(signal?: AbortSignal): Promise<Trip[]> {
  const result = await request(API_ROUTES.trips, 'GET', undefined, signal);
  return tripListSchema.parse(result.body);
}

export async function getTrip(
  tripId: string,
  signal?: AbortSignal,
): Promise<StoredTripHandle> {
  const result = await request(path(tripId), 'GET', undefined, signal);
  return createHandle(result);
}

export async function createTrip(
  input: TripInput,
  signal?: AbortSignal,
): Promise<StoredTripHandle> {
  const result = await request(API_ROUTES.trips, 'POST', input, signal);
  return createHandle(result);
}

export async function saveTrip(
  tripId: string,
  expectedRevision: string,
  input: TripInput,
  signal?: AbortSignal,
): Promise<StoredTripHandle> {
  const result = await request(
    path(tripId),
    'PUT',
    input,
    signal,
    expectedRevision,
  );
  return createHandle(result);
}

export async function deleteTrip(
  tripId: string,
  expectedRevision: string,
  signal?: AbortSignal,
): Promise<string> {
  const result = await request(
    path(tripId),
    'DELETE',
    undefined,
    signal,
    expectedRevision,
  );
  return parseRevision(result.response);
}

export function isTripRevisionConflict(cause: unknown): boolean {
  return cause instanceof TripApiError && cause.status === 412;
}

function createHandle(result: ResponseResult): StoredTripHandle {
  return {
    trip: tripSchema.parse(result.body),
    revision: parseRevision(result.response),
  };
}

function parseRevision(response: Response): string {
  const value = response.headers.get('ETag')?.trim() ?? '';
  const match = revisionEtagPattern.exec(value);
  if (!match) {
    throw new Error(L('errors:trips.error.travelRequestCannotBeProcessed'));
  }
  return match[1];
}

function formatEtag(revision: string): string {
  if (!/^[1-9]\d*$/.test(revision)) {
    throw new Error(L('errors:trips.error.travelRequestCannotBeProcessed'));
  }
  return `"${revision}"`;
}

function getErrorCode(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('error' in value)) {
    return null;
  }
  const error = value.error;
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null;
  }
  return typeof error.code === 'string' ? error.code : null;
}
