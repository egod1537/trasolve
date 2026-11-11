import type { Trip } from '@trasolve/shared';
import { serializeTripCommandPlanState } from '../ai-command/TripCommandPlanFingerprint';

/** Save metadata cannot invalidate a proposal; trip identity and edits can. */
export function commandFingerprint(trip: Trip): string {
  return JSON.stringify([trip.id, serializeTripCommandPlanState(trip)]);
}
