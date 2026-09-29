import { z } from 'zod';
import { tripPolylineModeSchema } from '@trasolve/shared';

// Provider-independent input contract for future travel-planning reasoning.
// This module never calls a model or an external provider; it only describes
// the shape of what a planner would be given to reason about.
//
// v2 (Slice 5): adds structured `opensAt`/`closesAt` to EXTERNAL_EVIDENCE so
// opening-hours feasibility can be checked deterministically from supplied
// evidence, rather than from free-form `detail` text. A payload stamped with
// the old `contextVersion: 1` no longer validates against this schema.
export const PLANNER_CONTEXT_VERSION = 2 as const;

// Opaque identity token for an existing Trip/Day/Place/Polyline entity.
// Deliberately NOT `@trasolve/shared`'s `tripIdSchema`: that schema encodes a
// storage-layer constraint (IDs must be safe as a single filesystem path
// segment) that has nothing to do with planning. Per the Slice 3/4
// architecture sync, PlannerContext/PlanningProposal must not depend on Trip
// storage semantics -- IDs are carried through here as opaque tokens only.
export const plannerEntityIdSchema = z.string().trim().min(1).max(128);

// Opaque, caller-scoped identifier for constraints / evidence / recommendations
// / conflicts that exist only within a single context/proposal exchange. This
// is intentionally distinct from `plannerEntityIdSchema`, which identifies
// existing Trip/Day/Place/Polyline entities rather than context/proposal-local
// references.
export const plannerOpaqueIdSchema = z.string().trim().min(1).max(200);

const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const plannerLocationSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// FACT: a Place as it actually exists in the current Trip state. Every
// optional/unknown field is represented as `null`, never inferred.
const plannerFactPlaceSchema = z.strictObject({
  id: plannerEntityIdSchema,
  googlePlaceId: z.string().max(1024).nullable(),
  name: z.string().min(1).max(200),
  location: plannerLocationSchema,
  order: z.number().int().min(1).max(500),
  scheduledTime: clockTimeSchema.nullable(),
  visitDurationMinutes: z.number().int().min(0).nullable(),
  preferredDurationMinutes: z.number().int().min(0).nullable(),
  memo: z.string().max(4000).nullable(),
  address: z.string().max(2000).nullable(),
  // Whether opening-hours data is known for this Place. The internal shape of
  // opening hours is out of scope for this slice: no benchmark scenario
  // inspects it, and no scenario is allowed to assert hours without evidence.
  openingHoursKnown: z.boolean(),
});

// FACT: an existing route segment between two existing Places in a Day. A
// route `mode` describes how the segment is currently drawn; it is not proof
// that a route or travel-time value exists (see EXTERNAL_EVIDENCE below).
const plannerFactRouteSegmentSchema = z.strictObject({
  id: plannerEntityIdSchema,
  fromPlaceId: plannerEntityIdSchema,
  toPlaceId: plannerEntityIdSchema,
  order: z.number().int().min(1).max(500),
  mode: tripPolylineModeSchema,
});

const plannerFactDaySchema = z.strictObject({
  id: plannerEntityIdSchema,
  title: z.string().min(1).max(200),
  // Kept as a free-form string: persisted Trip days use an ISO date, while
  // demo/fixture Trip state may carry a localized display label instead.
  // PlannerContext passes through whatever the current Trip state has rather
  // than normalizing or validating calendar format.
  date: z.string().max(200).nullable(),
  // Days have no persisted `order` field; this reflects the Trip's existing
  // array position, which is the product's actual ordering semantic.
  order: z.number().int().min(1).max(100),
  places: z.array(plannerFactPlaceSchema).max(500),
  routeSegments: z.array(plannerFactRouteSegmentSchema).max(500),
});

const plannerTripFactSchema = z.strictObject({
  id: plannerEntityIdSchema.nullable(),
  title: z.string().min(1).max(200),
  startDate: z.string().max(200).nullable(),
  endDate: z.string().max(200).nullable(),
  updatedAt: z.string().max(200).nullable(),
  days: z.array(plannerFactDaySchema).max(100),
});

// Captured selection at context-build time. Selection limits attention but
// never alters Trip facts, and is optional: planning may proceed without it.
const plannerSelectedScopeSchema = z.strictObject({
  dayId: plannerEntityIdSchema.nullable(),
  placeIds: z.array(plannerEntityIdSchema).max(500),
  polylineIds: z.array(plannerEntityIdSchema).max(500),
});

// Opaque staleness/provenance anchor. This module never computes it; a
// caller supplies it (or omits it) from whatever source-snapshot mechanism
// exists elsewhere in the product. See buildPlannerContext.ts for details.
// Exported so PlanningProposal can reuse this exact schema for its own
// `source` field rather than duplicating provenance semantics (Slice 4).
export const plannerSourceSchema = z.strictObject({
  tripId: plannerEntityIdSchema.nullable(),
  snapshotToken: z.string().max(500).nullable(),
});

// CONSTRAINT: an explicit planning rule supplied by the caller. Constraints
// are never inferred from the shape of existing Trip state (e.g. an existing
// scheduled time is a FACT, not automatically a CONSTRAINT).
const constraintKindSchema = z.enum([
  'FIXED_TIME',
  'FIXED_DAY',
  'REQUIRED_INCLUSION',
  'ORDERING',
  'TIME_WINDOW',
  'EXTERNAL_TRAVEL_TIME',
  'OTHER',
]);

const plannerConstraintSchema = z.strictObject({
  id: plannerOpaqueIdSchema,
  kind: constraintKindSchema,
  subjectPlaceId: plannerEntityIdSchema.nullable(),
  subjectDayId: plannerEntityIdSchema.nullable(),
  statement: z.string().trim().min(1).max(1000),
  hard: z.boolean(),
});

// USER_PREFERENCE: an explicit, run-scoped preference. Never defaulted.
const preferenceKindSchema = z.enum([
  'PACE',
  'CATEGORY',
  'TRANSPORT_MODE',
  'ITINERARY_STYLE',
  'OTHER',
]);

const plannerUserPreferenceSchema = z.strictObject({
  kind: preferenceKindSchema,
  statement: z.string().trim().min(1).max(1000),
});

// MISSING_UNKNOWN: an explicit, caller-supplied statement of what is not
// known. This module does not auto-derive these from null FACT fields --
// per-field absence is already represented honestly via `null` above: a
// MISSING_UNKNOWN entry is for coarser gaps a caller chooses to surface
// (e.g. "no authoritative transit schedule was supplied for this trip").
const missingUnknownReasonSchema = z.enum([
  'NOT_SUPPLIED',
  'NOT_VERIFIABLE',
  'NO_DATA',
  'OTHER',
]);

const plannerMissingUnknownSchema = z.strictObject({
  path: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(1000),
  reason: missingUnknownReasonSchema,
});

// EXTERNAL_EVIDENCE: authoritative evidence explicitly supplied by the
// caller. This module never fetches evidence; it only validates and carries
// it through. `directional` must be honest about whether the value applies
// only in the given `subjectPlaceIds` order.
const externalEvidenceKindSchema = z.enum([
  'PLACE_DETAILS',
  'TRAVEL_TIME',
  'TRANSIT',
  'OPENING_HOURS',
  'OTHER',
]);

const plannerExternalEvidenceSchema = z.strictObject({
  id: plannerOpaqueIdSchema,
  kind: externalEvidenceKindSchema,
  sourceLabel: z.string().trim().min(1).max(200),
  capturedAt: z.string().max(200).nullable(),
  subjectPlaceIds: z.array(plannerEntityIdSchema).min(1).max(2),
  directional: z.boolean(),
  mode: tripPolylineModeSchema.nullable(),
  durationMinutes: z.number().min(0).nullable(),
  // Structured same-day open/close times, populated only for
  // kind === 'OPENING_HOURS' evidence (null otherwise). Kept as plain
  // clock-time strings, not a full opening-hours schema: no benchmark
  // scenario needs multi-period/overnight hours, and a feasibility check can
  // only ever compare a single scheduled time against a single window.
  opensAt: clockTimeSchema.nullable(),
  closesAt: clockTimeSchema.nullable(),
  detail: z.string().max(2000).nullable(),
});

export const plannerContextSchema = z.strictObject({
  contextVersion: z.literal(PLANNER_CONTEXT_VERSION),
  tripFact: plannerTripFactSchema,
  selectedScope: plannerSelectedScopeSchema.nullable(),
  source: plannerSourceSchema,
  userInstruction: z.string().trim().min(1).max(4000).nullable(),
  knownConstraints: z.array(plannerConstraintSchema).max(200),
  userPreferences: z.array(plannerUserPreferenceSchema).max(200),
  externalEvidence: z.array(plannerExternalEvidenceSchema).max(500),
  missingUnknown: z.array(plannerMissingUnknownSchema).max(500),
});

export type PlannerContext = z.infer<typeof plannerContextSchema>;
export type PlannerTripFact = z.infer<typeof plannerTripFactSchema>;
export type PlannerFactDay = z.infer<typeof plannerFactDaySchema>;
export type PlannerFactPlace = z.infer<typeof plannerFactPlaceSchema>;
export type PlannerFactRouteSegment = z.infer<
  typeof plannerFactRouteSegmentSchema
>;
export type PlannerSelectedScope = z.infer<typeof plannerSelectedScopeSchema>;
export type PlannerSource = z.infer<typeof plannerSourceSchema>;
export type PlannerConstraint = z.infer<typeof plannerConstraintSchema>;
export type PlannerConstraintInput = z.input<typeof plannerConstraintSchema>;
export type PlannerUserPreference = z.infer<typeof plannerUserPreferenceSchema>;
export type PlannerUserPreferenceInput = z.input<
  typeof plannerUserPreferenceSchema
>;
export type PlannerExternalEvidence = z.infer<
  typeof plannerExternalEvidenceSchema
>;
export type PlannerExternalEvidenceInput = z.input<
  typeof plannerExternalEvidenceSchema
>;
export type PlannerMissingUnknown = z.infer<typeof plannerMissingUnknownSchema>;
export type PlannerMissingUnknownInput = z.input<
  typeof plannerMissingUnknownSchema
>;
