import {
  buildSharedTripApiRoute,
  buildTripShareApiRoute,
  sharedTripSchema,
  tripIdSchema,
  tripShareSettingsSchema,
  tripShareTokenSchema,
  updateTripShareRequestSchema,
  type SharedTrip,
  type TripShareSettings,
  type UpdateTripShareRequest,
} from '@trasolve/shared';

export class TripSharingApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super('Trip sharing request failed.');
    this.name = 'TripSharingApiError';
  }
}

export async function getTripShareSettings(
  tripId: string,
  signal?: AbortSignal,
): Promise<TripShareSettings> {
  const body = await request(ownerPath(tripId), { method: 'GET', signal });
  return tripShareSettingsSchema.parse(body);
}

export async function updateTripShareSettings(
  tripId: string,
  input: UpdateTripShareRequest,
  signal?: AbortSignal,
): Promise<TripShareSettings> {
  const payload = updateTripShareRequestSchema.parse(input);
  const body = await request(ownerPath(tripId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  return tripShareSettingsSchema.parse(body);
}

export async function getSharedTrip(
  token: string,
  signal?: AbortSignal,
): Promise<SharedTrip> {
  const body = await request(
    buildSharedTripApiRoute(tripShareTokenSchema.parse(token)),
    { method: 'GET', signal },
  );
  return sharedTripSchema.parse(body);
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  const timeout = AbortSignal.timeout(20000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  const response = await fetch(path, { ...init, signal });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new TripSharingApiError(response.status, getErrorCode(body));
  }
  return body;
}

function ownerPath(tripId: string): string {
  const id = tripIdSchema.parse(tripId);
  return buildTripShareApiRoute(id);
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
