import type { Trip } from '@trasolve/shared';

const FINGERPRINT_PREFIX = 'sha256:';

export async function createTripCommandPlanFingerprint(
  trip: Trip,
): Promise<string> {
  const bytes = new TextEncoder().encode(serializeTripCommandPlanState(trip));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `${FINGERPRINT_PREFIX}${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')}`;
}

/** Canonical editable state; persistence metadata is intentionally excluded. */
export function serializeTripCommandPlanState(trip: Trip): string {
  return JSON.stringify(
    canonicalize({
      title: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: trip.days,
    }),
  );
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== undefined) {
      result[key] = canonicalize(child);
    }
  }
  return result;
}
