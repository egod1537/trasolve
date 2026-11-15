/** Bounded metadata only: never prompts, source labels, IDs, addresses or payloads. */
const reasons = [
  'destination_context',
  'destination_day_count',
  'destination_candidates',
  'destination_details',
  'destination_translations',
  'destination_address',
  'plan_destination_conflict',
  'place_autocomplete_empty',
  'place_candidate_limit',
  'place_details_identity',
  'place_region',
  'place_translation_identity',
  'place_matches',
  'lookup_request_failed',
  'duplicate_days',
  'day_total_mismatch',
  'preview_ready',
  'prepare_error',
] as const;
export type TripPlanDiagnostic = Readonly<{
  stage: 'plan' | 'destination' | 'place';
  outcome: 'rejected' | 'resolved';
  reason: (typeof reasons)[number];
  operationOrdinal?: number;
  autocompleteCount?: number;
  candidateCount?: number;
  regionMatchCount?: number;
  nameMatchCount?: number;
  matchCount?: number;
  existingDays?: number;
  addedDays?: number;
  requestedDays?: number;
  proposedDays?: number;
  identityMatch?: boolean;
  countryPresent?: boolean;
  addressPresent?: boolean;
  labelMatch?: boolean;
  typedRegionMatch?: boolean;
  hasName?: boolean;
  hasLocality?: boolean;
  hasCountryCode?: boolean;
}>;
export type TripPlanDiagnosticSink = (event: TripPlanDiagnostic) => void;

export function reportTripPlanDiagnostic(
  sink: TripPlanDiagnosticSink | undefined,
  event: TripPlanDiagnostic,
): void {
  if (
    !sink ||
    !['plan', 'destination', 'place'].includes(event.stage) ||
    !['rejected', 'resolved'].includes(event.outcome) ||
    !reasons.includes(event.reason)
  ) {
    return;
  }
  const safe: Record<string, unknown> = {
    stage: event.stage,
    outcome: event.outcome,
    reason: event.reason,
  };
  for (const key of [
    'operationOrdinal',
    'autocompleteCount',
    'candidateCount',
    'regionMatchCount',
    'nameMatchCount',
    'matchCount',
    'existingDays',
    'addedDays',
    'requestedDays',
    'proposedDays',
  ] as const) {
    const value = event[key];
    if (
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0
    ) {
      safe[key] = Math.min(value, 10000);
    }
  }
  for (const key of [
    'identityMatch',
    'countryPresent',
    'addressPresent',
    'labelMatch',
    'typedRegionMatch',
    'hasName',
    'hasLocality',
    'hasCountryCode',
  ] as const) {
    if (typeof event[key] === 'boolean') {
      safe[key] = event[key];
    }
  }
  try {
    sink(Object.freeze(safe) as TripPlanDiagnostic);
  } catch {
    /* Observers cannot change preparation or saving. */
  }
}
