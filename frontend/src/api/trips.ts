import {
  API_ROUTES,
  apiErrorSchema,
  tripMapIdSchema,
  tripMapSchema,
  tripMapListSchema,
  tripMapInputSchema,
  type TripMap,
  type TripMapInput,
} from '@trasolve/shared';

async function request(
  path: string,
  method: string,
  input?: TripMapInput,
  signal?: AbortSignal,
): Promise<unknown> {
  const payload =
    input === undefined ? undefined : tripMapInputSchema.parse(input);
  const timeout = AbortSignal.timeout(20000);
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new Error(
      timeout.aborted
        ? '여행 요청 시간이 초과됐습니다. 목록을 새로고침해 저장 여부를 확인해 주세요.'
        : '여행 서버에 연결할 수 없습니다.',
    );
  }
  if (response.ok && response.status === 204) return undefined;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new Error(
      parsed.success
        ? parsed.data.error.message
        : '여행 요청을 처리할 수 없습니다.',
    );
  }
  return body;
}
function path(tripId: string): string {
  return `${API_ROUTES.trips}/${encodeURIComponent(tripMapIdSchema.parse(tripId))}`;
}
export async function listTrips(signal?: AbortSignal): Promise<TripMap[]> {
  return tripMapListSchema.parse(
    await request(API_ROUTES.trips, 'GET', undefined, signal),
  );
}
export async function getTrip(
  tripId: string,
  signal?: AbortSignal,
): Promise<TripMap> {
  return tripMapSchema.parse(
    await request(path(tripId), 'GET', undefined, signal),
  );
}
export async function createTrip(
  input: TripMapInput,
  signal?: AbortSignal,
): Promise<TripMap> {
  return tripMapSchema.parse(
    await request(API_ROUTES.trips, 'POST', input, signal),
  );
}
export async function saveTrip(
  tripId: string,
  input: TripMapInput,
  signal?: AbortSignal,
): Promise<TripMap> {
  return tripMapSchema.parse(await request(path(tripId), 'PUT', input, signal));
}
export async function deleteTrip(
  tripId: string,
  signal?: AbortSignal,
): Promise<void> {
  await request(path(tripId), 'DELETE', undefined, signal);
}

export interface TripMapApi {
  getTrip: typeof getTrip;
  createTrip: typeof createTrip;
  saveTrip: typeof saveTrip;
  deleteTrip: typeof deleteTrip;
}
export const tripMapApi: TripMapApi = {
  getTrip,
  createTrip,
  saveTrip,
  deleteTrip,
};
