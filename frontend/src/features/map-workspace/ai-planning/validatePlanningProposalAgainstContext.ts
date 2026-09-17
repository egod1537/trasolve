import type { PlannerContext } from './types/plannerContext';
import type { PlanningProposal } from './types/planningProposal';

// This module checks whether a PlanningProposal is GROUNDED in the
// PlannerContext it claims to be based on -- i.e. whether every reference it
// makes actually exists in that context, and whether its stated provenance
// matches. It never judges itinerary quality (that is subjective and not
// deterministic), and it never checks or produces anything execution-shaped:
// no TripCommand, no diff, no mutation risk assessment. That is a separate,
// deterministic product-logic boundary owned elsewhere (see the Slice 4
// architecture-sync notes in buildPlannerContext.ts).
export type GroundingIssueCode =
  | 'SOURCE_TRIP_MISMATCH'
  | 'SOURCE_SNAPSHOT_MISMATCH'
  | 'UNKNOWN_DAY_ID'
  | 'UNKNOWN_PLACE_ID'
  | 'UNKNOWN_EVIDENCE_ID'
  | 'UNKNOWN_CONSTRAINT_ID'
  | 'EVIDENCE_DIRECTION_MISMATCH';

export interface GroundingIssue {
  code: GroundingIssueCode;
  message: string;
  // Human-readable pointer into the proposal, e.g.
  // "recommendations[0].subjectPlaceId". Not a JSON Pointer/Patch path -- it
  // identifies where an issue was found, it does not describe an edit.
  path: string;
}

export interface GroundingValidationResult {
  valid: boolean;
  issues: GroundingIssue[];
}

// Assumes `context` and `proposal` are already schema-valid (i.e. each has
// already been through `plannerContextSchema`/`planningProposalSchema`).
// This function only checks cross-referential grounding between the two; it
// does not re-validate either shape.
export function validatePlanningProposalAgainstContext(
  context: PlannerContext,
  proposal: PlanningProposal,
): GroundingValidationResult {
  const issues: GroundingIssue[] = [];

  const dayIds = new Set(context.tripFact.days.map((day) => day.id));
  const placeIds = new Set(
    context.tripFact.days.flatMap((day) => day.places.map((place) => place.id)),
  );
  const evidenceById = new Map(
    context.externalEvidence.map(
      (evidence) => [evidence.id, evidence] as const,
    ),
  );
  const constraintIds = new Set(
    context.knownConstraints.map((constraint) => constraint.id),
  );

  function checkDayId(id: string | null, path: string): void {
    if (id !== null && !dayIds.has(id)) {
      issues.push({
        code: 'UNKNOWN_DAY_ID',
        message: `Day ID "${id}" does not exist in the PlannerContext this proposal claims to be grounded in.`,
        path,
      });
    }
  }

  function checkPlaceId(id: string, path: string): void {
    if (!placeIds.has(id)) {
      issues.push({
        code: 'UNKNOWN_PLACE_ID',
        message: `Place ID "${id}" does not exist in the PlannerContext this proposal claims to be grounded in.`,
        path,
      });
    }
  }

  function checkEvidenceId(id: string, path: string): void {
    if (!evidenceById.has(id)) {
      issues.push({
        code: 'UNKNOWN_EVIDENCE_ID',
        message: `Evidence ID "${id}" was not supplied in PlannerContext.externalEvidence.`,
        path,
      });
    }
  }

  // --- Provenance: the proposal must be attributable to this exact context.
  if (proposal.source.tripId !== context.source.tripId) {
    issues.push({
      code: 'SOURCE_TRIP_MISMATCH',
      message: `Proposal source.tripId (${JSON.stringify(proposal.source.tripId)}) does not match PlannerContext.source.tripId (${JSON.stringify(context.source.tripId)}).`,
      path: 'source.tripId',
    });
  }
  if (proposal.source.snapshotToken !== context.source.snapshotToken) {
    issues.push({
      code: 'SOURCE_SNAPSHOT_MISMATCH',
      message:
        'Proposal source.snapshotToken does not match the PlannerContext it claims to be based on.',
      path: 'source.snapshotToken',
    });
  }

  // --- Scope references.
  proposal.scope.dayIds.forEach((id, index) =>
    checkDayId(id, `scope.dayIds[${index}]`),
  );
  proposal.scope.placeIds.forEach((id, index) =>
    checkPlaceId(id, `scope.placeIds[${index}]`),
  );

  // --- Recommendations. EXISTING_PLACE must reference a real Place ID;
  // NEW_PLACE_INTENT structurally cannot (see planningProposal.ts's
  // discriminated union), so there is nothing to fabricate-check there.
  proposal.recommendations.forEach((recommendation, index) => {
    if (recommendation.subjectKind === 'EXISTING_PLACE') {
      checkPlaceId(
        recommendation.subjectPlaceId,
        `recommendations[${index}].subjectPlaceId`,
      );
    }
    checkDayId(
      recommendation.recommendedDayId,
      `recommendations[${index}].recommendedDayId`,
    );
    recommendation.evidenceRefs.forEach((id, refIndex) =>
      checkEvidenceId(
        id,
        `recommendations[${index}].evidenceRefs[${refIndex}]`,
      ),
    );
  });

  // --- Conflicts.
  proposal.conflicts.forEach((conflict, index) => {
    conflict.involvedPlaceIds.forEach((id, placeIndex) =>
      checkPlaceId(id, `conflicts[${index}].involvedPlaceIds[${placeIndex}]`),
    );
    conflict.involvedDayIds.forEach((id, dayIndex) =>
      checkDayId(id, `conflicts[${index}].involvedDayIds[${dayIndex}]`),
    );
    conflict.evidenceRefs.forEach((id, refIndex) => {
      checkEvidenceId(id, `conflicts[${index}].evidenceRefs[${refIndex}]`);

      // Deterministic directional-evidence-misuse check: a one-directional
      // evidence value (e.g. a transit duration measured only A->B) must not
      // be relied on for a conflict that lists the same two places in the
      // reverse order. This is the structural form of benchmark scenario G's
      // hard-fail ("must not substitute the reversed value").
      const evidence = evidenceById.get(id);
      if (
        !evidence ||
        !evidence.directional ||
        evidence.subjectPlaceIds.length !== 2
      ) {
        return;
      }
      const [from, to] = evidence.subjectPlaceIds;
      const fromIndex = conflict.involvedPlaceIds.indexOf(from);
      const toIndex = conflict.involvedPlaceIds.indexOf(to);
      if (fromIndex === -1 || toIndex === -1 || fromIndex < toIndex) {
        return;
      }
      issues.push({
        code: 'EVIDENCE_DIRECTION_MISMATCH',
        message: `Evidence "${id}" is directional (${from} -> ${to} only) but conflict "${conflict.id}" lists these places in the reverse order, implying reverse-direction use of a one-directional value.`,
        path: `conflicts[${index}].evidenceRefs[${refIndex}]`,
      });
    });
  });

  // --- Top-level evidence/constraint references.
  proposal.evidenceUsed.forEach((id, index) =>
    checkEvidenceId(id, `evidenceUsed[${index}]`),
  );
  proposal.preservedConstraints.forEach((id, index) => {
    if (!constraintIds.has(id)) {
      issues.push({
        code: 'UNKNOWN_CONSTRAINT_ID',
        message: `preservedConstraints references constraint ID "${id}", which is not in PlannerContext.knownConstraints.`,
        path: `preservedConstraints[${index}]`,
      });
    }
  });

  return { valid: issues.length === 0, issues };
}
