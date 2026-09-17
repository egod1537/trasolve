import type {
  PlannerContext,
  PlannerExternalEvidence,
  PlannerFactDay,
  PlannerFactPlace,
  PlannerFactRouteSegment,
} from './types/plannerContext';
import type { PlanningProposal } from './types/planningProposal';

// This module distinguishes what CAN be determined from currently grounded
// facts/evidence versus what CANNOT be claimed without authoritative
// external evidence. It never fetches data, never mutates Trip/Proposal
// state, and never produces execution-shaped output (no TripCommand, no
// diff, no confirmation policy) -- that is a separate, deterministic
// product-logic boundary owned elsewhere. It also never encodes anything
// specific to the frozen benchmark's Tokyo sample data: every rule here is a
// general evidence invariant (directional evidence, known duration +
// schedule arithmetic, structured opening-hours windows).
export type FeasibilityStatus =
  // Directly confirmed by supplied evidence (e.g. a scheduled time falls
  // inside a supplied opening-hours window).
  | 'VERIFIED'
  // Computed deterministically by combining multiple grounded facts/evidence
  // (e.g. start time + duration + travel time -> arrival time).
  | 'DERIVABLE'
  // The base facts needed are known, but a specific authoritative evidence
  // item is absent (e.g. no directional travel-time evidence supplied).
  | 'MISSING_EVIDENCE'
  // A deterministic contradiction was found from grounded facts/evidence.
  | 'CONFLICT'
  // Cannot even be attempted: a required base FACT (not evidence) is absent
  // (e.g. no scheduled time at all for the place).
  | 'UNKNOWN';

export type FeasibilityCheckKind = 'SCHEDULE_TRANSITION' | 'OPENING_HOURS';

export interface FeasibilityFinding {
  kind: FeasibilityCheckKind;
  status: FeasibilityStatus;
  dayId: string;
  involvedPlaceIds: string[];
  // What is being assessed and, for DERIVABLE/CONFLICT/VERIFIED, why.
  summary: string;
  // Human-readable arithmetic/comparison trace; null when nothing could be
  // computed.
  calculation: string | null;
  // externalEvidence[].id values actually relied on for this finding.
  evidenceRefs: string[];
  // Human-readable description of what is absent, when the status reflects
  // a gap (MISSING_EVIDENCE/UNKNOWN); empty otherwise.
  missingRequirements: string[];
  // Only meaningful when a proposal was supplied: whether this finding's
  // Day/Place is referenced anywhere in that proposal's scope,
  // recommendations, or conflicts. `null` when no proposal was supplied.
  referencedByProposal: boolean | null;
}

export interface FeasibilityAssessment {
  findings: FeasibilityFinding[];
}

function parseClockMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatClockMinutes(totalMinutes: number): string {
  // Same-day arithmetic only: a result crossing midnight wraps within the
  // 24-hour clock rather than advancing to a following calendar day. No
  // benchmark scenario requires cross-midnight scheduling, and silently
  // guessing a day rollover would be inventing a fact this module does not
  // have.
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// A transport mode alone never implies a duration, line, departure, or
// transfer (see plannerContext.ts's FACT route-segment doc comment). Travel
// duration can only come from explicitly supplied, correctly-directed
// TRAVEL_TIME/TRANSIT evidence.
function findTravelEvidence(
  evidence: readonly PlannerExternalEvidence[],
  fromPlaceId: string,
  toPlaceId: string,
): PlannerExternalEvidence | null {
  for (const item of evidence) {
    if (item.kind !== 'TRAVEL_TIME' && item.kind !== 'TRANSIT') {
      continue;
    }
    if (item.durationMinutes === null) {
      continue;
    }
    if (item.subjectPlaceIds.length !== 2) {
      continue;
    }
    const [a, b] = item.subjectPlaceIds;
    if (item.directional) {
      // A one-directional value may only be used in the exact order it was
      // measured. The reverse leg (toPlaceId -> fromPlaceId) must not reuse
      // it: that leg stays MISSING_EVIDENCE until its own evidence exists.
      if (a === fromPlaceId && b === toPlaceId) {
        return item;
      }
    } else if (
      (a === fromPlaceId && b === toPlaceId) ||
      (a === toPlaceId && b === fromPlaceId)
    ) {
      return item;
    }
  }
  return null;
}

function findOpeningHoursEvidence(
  evidence: readonly PlannerExternalEvidence[],
  placeId: string,
): PlannerExternalEvidence | null {
  return (
    evidence.find(
      (item) =>
        item.kind === 'OPENING_HOURS' &&
        item.subjectPlaceIds.length === 1 &&
        item.subjectPlaceIds[0] === placeId,
    ) ?? null
  );
}

function assessScheduleTransition(
  day: PlannerFactDay,
  segment: PlannerFactRouteSegment,
  placesById: ReadonlyMap<string, PlannerFactPlace>,
  evidence: readonly PlannerExternalEvidence[],
): FeasibilityFinding {
  const involvedPlaceIds = [segment.fromPlaceId, segment.toPlaceId];
  const base = {
    kind: 'SCHEDULE_TRANSITION' as const,
    dayId: day.id,
    involvedPlaceIds,
    referencedByProposal: null as boolean | null,
  };

  const fromPlace = placesById.get(segment.fromPlaceId);
  const toPlace = placesById.get(segment.toPlaceId);
  if (!fromPlace || !toPlace) {
    return {
      ...base,
      status: 'UNKNOWN',
      summary:
        'Route segment references a Place ID not present in this PlannerContext.',
      calculation: null,
      evidenceRefs: [],
      missingRequirements: ['from/to place present in context'],
    };
  }

  if (fromPlace.scheduledTime === null) {
    return {
      ...base,
      status: 'UNKNOWN',
      summary: `${fromPlace.name}'s scheduled time is unknown, so a departure time toward ${toPlace.name} cannot be established.`,
      calculation: null,
      evidenceRefs: [],
      missingRequirements: [`scheduledTime for place ${fromPlace.id}`],
    };
  }
  if (fromPlace.visitDurationMinutes === null) {
    return {
      ...base,
      status: 'UNKNOWN',
      summary: `${fromPlace.name} has a known start time (${fromPlace.scheduledTime}) but no known visit duration, so its end time cannot be established.`,
      calculation: null,
      evidenceRefs: [],
      missingRequirements: [`visitDurationMinutes for place ${fromPlace.id}`],
    };
  }

  const departureMinutes =
    parseClockMinutes(fromPlace.scheduledTime) + fromPlace.visitDurationMinutes;
  const departureClock = formatClockMinutes(departureMinutes);
  const endCalculation = `${fromPlace.scheduledTime} + ${fromPlace.visitDurationMinutes}min = ${departureClock}`;

  const travelEvidence = findTravelEvidence(
    evidence,
    segment.fromPlaceId,
    segment.toPlaceId,
  );
  if (!travelEvidence) {
    const transitNote =
      segment.mode === 'transit'
        ? ' The route mode is "transit", but a transport mode alone does not imply a duration, line, departure, or transfer; transit feasibility cannot be asserted without authoritative evidence.'
        : '';
    return {
      ...base,
      status: 'MISSING_EVIDENCE',
      summary: `${fromPlace.name} is known to end at ${departureClock}, but no directional travel-time evidence from ${segment.fromPlaceId} to ${segment.toPlaceId} was supplied, so arrival at ${toPlace.name} cannot be determined.${transitNote}`,
      calculation: endCalculation,
      evidenceRefs: [],
      missingRequirements: [
        `directional travel-time evidence from ${segment.fromPlaceId} to ${segment.toPlaceId}`,
      ],
    };
  }

  const travelMinutes = travelEvidence.durationMinutes ?? 0;
  const arrivalMinutes = departureMinutes + travelMinutes;
  const arrivalClock = formatClockMinutes(arrivalMinutes);
  const arrivalCalculation = `${endCalculation}; ${departureClock} + ${travelMinutes}min = ${arrivalClock}`;

  if (toPlace.scheduledTime === null) {
    return {
      ...base,
      status: 'DERIVABLE',
      summary: `Computed arrival at ${toPlace.name} of ${arrivalClock}; ${toPlace.name} has no scheduled time to compare it against.`,
      calculation: arrivalCalculation,
      evidenceRefs: [travelEvidence.id],
      missingRequirements: [],
    };
  }

  const scheduledMinutes = parseClockMinutes(toPlace.scheduledTime);
  if (arrivalMinutes > scheduledMinutes) {
    const overMinutes = arrivalMinutes - scheduledMinutes;
    return {
      ...base,
      status: 'CONFLICT',
      summary: `Computed arrival at ${toPlace.name} (${arrivalClock}) is after its scheduled time (${toPlace.scheduledTime}) by ${overMinutes} minutes.`,
      calculation: `${arrivalCalculation} > ${toPlace.scheduledTime} by ${overMinutes} minutes`,
      evidenceRefs: [travelEvidence.id],
      missingRequirements: [],
    };
  }

  return {
    ...base,
    status: 'DERIVABLE',
    summary: `Computed arrival at ${toPlace.name} (${arrivalClock}) is at or before its scheduled time (${toPlace.scheduledTime}).`,
    calculation: arrivalCalculation,
    evidenceRefs: [travelEvidence.id],
    missingRequirements: [],
  };
}

// Deliberately ignores `place.openingHoursKnown`: that flag only records
// whether the source Trip's Place record has *some* opening-hours data
// attached, not its content, and per the Slice 5 spec it must never be used
// to infer feasibility. Only explicit OPENING_HOURS evidence with a
// structured window can produce VERIFIED/CONFLICT here.
function assessOpeningHours(
  day: PlannerFactDay,
  place: PlannerFactPlace,
  evidence: readonly PlannerExternalEvidence[],
): FeasibilityFinding | null {
  if (place.scheduledTime === null) {
    return null;
  }

  const base = {
    kind: 'OPENING_HOURS' as const,
    dayId: day.id,
    involvedPlaceIds: [place.id],
    referencedByProposal: null as boolean | null,
  };

  const openingEvidence = findOpeningHoursEvidence(evidence, place.id);
  if (!openingEvidence) {
    return {
      ...base,
      status: 'MISSING_EVIDENCE',
      summary: `${place.name} is scheduled at ${place.scheduledTime}, but no authoritative opening-hours evidence was supplied, so opening-hours feasibility cannot be determined.`,
      calculation: null,
      evidenceRefs: [],
      missingRequirements: [`opening-hours evidence for place ${place.id}`],
    };
  }

  const { opensAt, closesAt } = openingEvidence;
  if (opensAt === null || closesAt === null || opensAt >= closesAt) {
    return {
      ...base,
      status: 'UNKNOWN',
      summary: `Opening-hours evidence for ${place.name} was supplied but does not give an unambiguous same-day open/close window, so feasibility at ${place.scheduledTime} cannot be determined.`,
      calculation: null,
      evidenceRefs: [openingEvidence.id],
      missingRequirements: [],
    };
  }

  if (place.scheduledTime >= opensAt && place.scheduledTime < closesAt) {
    return {
      ...base,
      status: 'VERIFIED',
      summary: `${place.name} is scheduled at ${place.scheduledTime}, within its known opening hours (${opensAt}-${closesAt}).`,
      calculation: `${opensAt} <= ${place.scheduledTime} < ${closesAt}`,
      evidenceRefs: [openingEvidence.id],
      missingRequirements: [],
    };
  }

  return {
    ...base,
    status: 'CONFLICT',
    summary: `${place.name} is scheduled at ${place.scheduledTime}, outside its known opening hours (${opensAt}-${closesAt}).`,
    calculation: `${place.scheduledTime} not within [${opensAt}, ${closesAt})`,
    evidenceRefs: [openingEvidence.id],
    missingRequirements: [],
  };
}

interface ProposalReferencedIds {
  dayIds: Set<string>;
  placeIds: Set<string>;
}

function collectProposalReferencedIds(
  proposal: PlanningProposal,
): ProposalReferencedIds {
  const dayIds = new Set<string>();
  const placeIds = new Set<string>();

  proposal.scope.dayIds.forEach((id) => dayIds.add(id));
  proposal.scope.placeIds.forEach((id) => placeIds.add(id));
  proposal.recommendations.forEach((recommendation) => {
    if (recommendation.subjectKind === 'EXISTING_PLACE') {
      placeIds.add(recommendation.subjectPlaceId);
    }
    if (recommendation.recommendedDayId) {
      dayIds.add(recommendation.recommendedDayId);
    }
  });
  proposal.conflicts.forEach((conflict) => {
    conflict.involvedPlaceIds.forEach((id) => placeIds.add(id));
    conflict.involvedDayIds.forEach((id) => dayIds.add(id));
  });

  return { dayIds, placeIds };
}

// Pure, deterministic, provider-independent. Reads only `context` (and
// optionally `proposal`, purely to tag which findings it touches); never
// fetches Places/Routes/transit, never mutates either input, and never
// produces a TripCommand, diff, or confirmation decision. `proposal` is
// optional: schedule/opening-hours feasibility of the Trip's own grounded
// state is assessable without any proposal at all.
export function assessPlanningFeasibility(
  context: PlannerContext,
  proposal?: PlanningProposal | null,
): FeasibilityAssessment {
  const findings: FeasibilityFinding[] = [];

  for (const day of context.tripFact.days) {
    const placesById = new Map(day.places.map((place) => [place.id, place]));

    for (const segment of day.routeSegments) {
      findings.push(
        assessScheduleTransition(
          day,
          segment,
          placesById,
          context.externalEvidence,
        ),
      );
    }
    for (const place of day.places) {
      const finding = assessOpeningHours(day, place, context.externalEvidence);
      if (finding) {
        findings.push(finding);
      }
    }
  }

  if (!proposal) {
    return { findings };
  }

  const referenced = collectProposalReferencedIds(proposal);
  return {
    findings: findings.map((finding) => ({
      ...finding,
      referencedByProposal:
        finding.involvedPlaceIds.some((id) => referenced.placeIds.has(id)) ||
        referenced.dayIds.has(finding.dayId),
    })),
  };
}
