import { z } from 'zod';
import { TRIP_PLACE_MAX_DURATION_MINUTES } from '@trasolve/shared';
import {
  PLANNER_CONTEXT_VERSION,
  plannerEntityIdSchema,
  plannerOpaqueIdSchema,
  plannerSourceSchema,
} from './plannerContext';

// Structured, NON-EXECUTABLE result of future planning reasoning over a
// PlannerContext. This schema intentionally has no field that could carry a
// TripCommand, a slash command, a JSON Patch, a store/controller/dispatcher
// instruction, or a model-generated internal entity ID. `z.strictObject` at
// every level rejects any such field if a caller/model attempts to add one,
// since it is not part of this contract.
//
// v2 (Slice 4): adds `source`, reusing PlannerContext's own source schema so
// a proposal remains attributable to the exact snapshot it was generated
// against. v1 payloads (no `source`) no longer validate.
export const PLANNING_PROPOSAL_VERSION = 2 as const;

const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const recommendationConceptSchema = z.enum([
  'DAY_ASSIGNMENT',
  'VISIT_ORDER',
  'VISIT_TIME',
  'VISIT_DURATION',
]);

// Fields shared by both recommendation subject variants below.
const recommendationCommonFields = {
  id: plannerOpaqueIdSchema,
  concept: recommendationConceptSchema,
  // Existing Day ID copied from PlannerContext, never invented.
  recommendedDayId: plannerEntityIdSchema.nullable(),
  recommendedDayTitle: z.string().max(200).nullable(),
  recommendedOrder: z.number().int().min(1).max(500).nullable(),
  recommendedTime: clockTimeSchema.nullable(),
  recommendedDurationMinutes: z
    .number()
    .int()
    .min(0)
    .max(TRIP_PLACE_MAX_DURATION_MINUTES)
    .nullable(),
  explanation: z.string().trim().min(1).max(2000),
  // References to PlannerContext.externalEvidence[].id supplied for this run.
  // A proposal cannot introduce evidence that was not part of its context.
  evidenceRefs: z.array(plannerOpaqueIdSchema).max(50),
};

// A recommendation subject is either an existing domain entity (identified
// only by its existing ID -- names are for readability, never identity), or
// an intent to add a new Place, which must be resolved authoritatively by a
// later, separate boundary. It can never carry an internal/pending ID,
// coordinates-as-authority, or a raw PlaceInput.
export const planningRecommendationSchema = z.discriminatedUnion(
  'subjectKind',
  [
    z.strictObject({
      subjectKind: z.literal('EXISTING_PLACE'),
      subjectPlaceId: plannerEntityIdSchema,
      subjectPlaceName: z.string().max(200).nullable(),
      ...recommendationCommonFields,
    }),
    z.strictObject({
      subjectKind: z.literal('NEW_PLACE_INTENT'),
      searchQuery: z.string().trim().min(1).max(200),
      // Only set when EXTERNAL_EVIDENCE already verified an external place;
      // this module never verifies or resolves it.
      verifiedExternalPlaceId: z.string().trim().min(1).max(1024).nullable(),
      ...recommendationCommonFields,
    }),
  ],
);

const conflictCategorySchema = z.enum([
  'TIME_OVERLAP',
  'DURATION_OVERRUN',
  'ORDERING_CONFLICT',
  'MISSING_EVIDENCE',
  'OTHER',
]);

export const planningConflictSchema = z.strictObject({
  id: plannerOpaqueIdSchema,
  category: conflictCategorySchema,
  involvedPlaceIds: z.array(plannerEntityIdSchema).min(1).max(500),
  involvedDayIds: z.array(plannerEntityIdSchema).max(100),
  description: z.string().trim().min(1).max(2000),
  // Human-readable arithmetic trace, e.g. "14:30 + 40min = 15:10 vs 15:00".
  calculation: z.string().max(2000).nullable(),
  evidenceRefs: z.array(plannerOpaqueIdSchema).max(50),
  // Only populated when clearly defined; never asserted as authoritative.
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
});

const assumptionSchema = z.strictObject({
  statement: z.string().trim().min(1).max(1000),
  basis: z.enum(['DERIVED', 'ASSUMED']),
});

const missingInformationSchema = z.strictObject({
  description: z.string().trim().min(1).max(1000),
});

export const planningProposalSchema = z.strictObject({
  proposalVersion: z.literal(PLANNING_PROPOSAL_VERSION),
  // The PlannerContext shape this proposal was reasoned against.
  contextVersion: z.literal(PLANNER_CONTEXT_VERSION),
  // Copied verbatim from the PlannerContext.source this proposal was
  // generated against (see buildPlannerContext.ts). This module never
  // computes or interprets `snapshotToken`; it only carries it through so a
  // proposal remains attributable to the exact snapshot it was based on.
  // Reuses PlannerContext's own schema rather than duplicating this shape.
  source: plannerSourceSchema,
  summary: z.string().trim().min(1).max(2000),
  scope: z.strictObject({
    dayIds: z.array(plannerEntityIdSchema).max(100),
    placeIds: z.array(plannerEntityIdSchema).max(500),
  }),
  recommendations: z.array(planningRecommendationSchema).max(500),
  conflicts: z.array(planningConflictSchema).max(500),
  // IDs of PlannerContext.knownConstraints[] that this proposal honored.
  preservedConstraints: z.array(plannerOpaqueIdSchema).max(200),
  assumptions: z.array(assumptionSchema).max(200),
  missingInformation: z.array(missingInformationSchema).max(200),
  evidenceUsed: z.array(plannerOpaqueIdSchema).max(200),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  // Must state that no Trasolve state was changed by this proposal.
  nonExecutionNotice: z.string().trim().min(1).max(500),
});

export type PlanningProposal = z.infer<typeof planningProposalSchema>;
export type PlanningRecommendation = z.infer<
  typeof planningRecommendationSchema
>;
export type PlanningConflict = z.infer<typeof planningConflictSchema>;
export type PlanningProposalInput = z.input<typeof planningProposalSchema>;

export const DEFAULT_NON_EXECUTION_NOTICE =
  'This proposal is advisory only. No Trasolve Trip, Day, or Place state was changed.';
